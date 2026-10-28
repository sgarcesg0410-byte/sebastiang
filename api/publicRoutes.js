// ==============================================================================
// RUTAS PÚBLICAS ACOTADAS
// ==============================================================================
// Estas rutas existen para que el sitio público NO tenga que llamar a los
// endpoints de administración (que ahora exigen sesión firmada) ni descargar
// datos personales de clientes.
//
// Regla: devuelven lo mínimo imprescindible. Cero nombres, cero teléfonos,
// cero correos en las respuestas que consume un visitante anónimo.
// ==============================================================================

import { createReceiptToken, verifyReceiptToken, toPublicBooking, getTrustedClientIp } from './security.js';
import { computeBookingPaymentStatus } from './financials.js';
import { validateReferralCode } from './referrals.js';
import { isMongoConfigured, findMongoDocs } from './db/mongo.js';

/** Limitador en memoria para rutas públicas usando IP confiable + clave de recurso opcional. */
function createPublicRateLimiter({ max = 90, windowMs = 10 * 60 * 1000, keySelector = null } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const ip = getTrustedClientIp(req);
    const extraKey = typeof keySelector === 'function' ? String(keySelector(req) || '').trim() : '';
    const compositeKey = extraKey ? `${ip}:${extraKey}` : ip;
    const now = Date.now();
    const rec = hits.get(compositeKey) || { count: 0, reset: now + windowMs };
    if (now > rec.reset) {
      rec.count = 0;
      rec.reset = now + windowMs;
    }
    rec.count += 1;
    hits.set(compositeKey, rec);
    if (rec.count > max) {
      res.setHeader('Retry-After', Math.ceil((rec.reset - now) / 1000));
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta más tarde.' });
    }
    return next();
  };
}

/**
 * Registra las rutas públicas en la app de Express.
 * MongoDB Atlas es la única fuente de verdad persistente en la nube.
 *
 * @param {object} app
 * @param {object} deps
 * @param {Function} deps.getRuntimeDB  Devuelve la base en memoria.
 */
export function registerPublicRoutes(app, { getRuntimeDB } = {}) {
  const publicLimiter = createPublicRateLimiter();

  /**
   * Trae las reservas desde MongoDB Atlas (fuente única de verdad).
   */
  async function fetchCloudBookings() {
    if (isMongoConfigured()) {
      try {
        const mongoBookings = await findMongoDocs('bookings', {});
        if (mongoBookings && mongoBookings.length > 0) {
          return mongoBookings;
        }
      } catch (e) {
        console.warn('[Público] No se pudo leer bookings de MongoDB:', e?.message || e);
      }
    }
    return [];
  }

  /** Pagos registrados en MongoDB Atlas o memoria. */
  async function getPayments() {
    const db = (typeof getRuntimeDB === 'function' ? getRuntimeDB() : null) || {};
    const inMem = Array.isArray(db.payments) ? [...db.payments] : [];
    if (isMongoConfigured()) {
      try {
        const mongoPayments = await findMongoDocs('payments', {});
        if (mongoPayments && mongoPayments.length > 0) {
          const map = new Map();
          [...inMem, ...mongoPayments].forEach((p) => {
            if (p?.id) map.set(p.id, p);
          });
          return [...map.values()];
        }
      } catch (e) {
        console.warn('[Público] No se pudo leer payments de MongoDB:', e?.message || e);
      }
    }
    return inMem;
  }

  /** Reservas combinando la caché en memoria y MongoDB Atlas. */
  async function getAllBookings() {
    const db = (typeof getRuntimeDB === 'function' ? getRuntimeDB() : null) || {};
    const merged = new Map();
    for (const b of Array.isArray(db.bookings) ? db.bookings : []) {
      if (b?.id) merged.set(b.id, b);
    }
    for (const b of await fetchCloudBookings()) {
      if (b?.id) merged.set(b.id, { ...(merged.get(b.id) || {}), ...b });
    }
    return [...merged.values()];
  }

  /** Sesiones (galerías) combinando memoria y MongoDB Atlas. */
  async function getAllSessions() {
    const db = (typeof getRuntimeDB === 'function' ? getRuntimeDB() : null) || {};
    const sessions = [...(Array.isArray(db.sessions) ? db.sessions : [])];

    if (isMongoConfigured()) {
      try {
        const mongoSessions = await findMongoDocs('sessions', {});
        if (mongoSessions && mongoSessions.length > 0) {
          const map = new Map();
          [...sessions, ...mongoSessions].forEach(s => {
            if (s?.token) map.set(s.token, s);
          });
          return [...map.values()];
        }
      } catch (e) {
        console.warn('[Público] No se pudo leer sessions de MongoDB:', e?.message || e);
      }
    }

    return sessions;
  }

  // ----------------------------------------------------------------------------
  // 1. CUPOS OCUPADOS DEL CALENDARIO (sin ningún dato personal ni IDs internos)
  // ----------------------------------------------------------------------------
  // Devuelve solo lo necesario para pintar el calendario: cuándo y estado.
  // Protege la privacidad omitiendo por completo los IDs internos de las reservas.
  app.get('/api/public/schedule', publicLimiter, async (req, res) => {
    try {
      const bookings = await getAllBookings();
      const slots = bookings
        .filter(b => b && b.dateTime)
        .filter(b => !['cancelled', 'cancelada', 'anulada'].includes(String(b.status || '').toLowerCase()))
        .map(b => ({ dateTime: b.dateTime, status: b.status || 'pending' }));

      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.json({ slots });
    } catch (e) {
      console.warn('[Público] Error construyendo agenda:', e?.message || e);
      return res.status(500).json({ error: 'No se pudo cargar la agenda.' });
    }
  });

  // ----------------------------------------------------------------------------
  // 2. FIDELIDAD DEL CLIENTE (solo un booleano y un porcentaje, con rate limit estricto)
  // ----------------------------------------------------------------------------
  const loyaltyLimiter = createPublicRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
  app.get('/api/public/loyalty', loyaltyLimiter, async (req, res) => {
    const phone = String(req.query.phone || '').replace(/\D/g, '');
    if (phone.length < 10) {
      return res.json({ isLoyal: false, discountPercent: 0 });
    }

    const key = phone.slice(-8);
    const matches = (item) => {
      const other = String(item?.clientWhatsApp || '').replace(/\D/g, '');
      return other.length >= 8 && (other.endsWith(key) || key.endsWith(other.slice(-8)));
    };

    try {
      const [bookings, sessions] = await Promise.all([getAllBookings(), getAllSessions()]);
      const isLoyal = bookings.some(matches) || sessions.some(matches);
      // Nunca devolvemos el nombre ni el historial: solo si aplica el descuento.
      return res.json({ isLoyal, discountPercent: isLoyal ? 15 : 0 });
    } catch (e) {
      console.warn('[Público] Error verificando fidelidad:', e?.message || e);
      return res.json({ isLoyal: false, discountPercent: 0 });
    }
  });

  // ----------------------------------------------------------------------------
  // 2b. VALIDACIÓN DE CÓDIGO DE REFERIDO (Cero PII, rate-limit estricto 10/10m)
  // ----------------------------------------------------------------------------
  const referralLimiter = createPublicRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });
  app.get('/api/public/referral', referralLimiter, async (req, res) => {
    const code = String(req.query.code || '');
    const clientPhone = String(req.query.clientPhone || '');

    try {
      const [bookings, sessions] = await Promise.all([getAllBookings(), getAllSessions()]);
      const result = validateReferralCode({ code, clientPhone, bookings, sessions });
      return res.json(result);
    } catch (e) {
      console.warn('[Público] Error verificando código de referido:', e?.message || e);
      return res.json({ valid: false, discountPercent: 0, message: 'No se pudo verificar el código de referido.' });
    }
  });

  // ----------------------------------------------------------------------------
  // 3. RECIBO PÚBLICO POR TOKEN FIRMADO (una sola reserva, nunca el CRM)
  // ----------------------------------------------------------------------------
  // Sustituye a la descarga completa de reservas que hacía PublicReceiptView.
  app.get('/api/public/receipt/:token', publicLimiter, async (req, res) => {
    // Solo tokens firmados: el ID crudo de la reserva nunca autoriza ver el comprobante.
    const bookingId = verifyReceiptToken(req.params.token);
    if (!bookingId) {
      return res.status(404).json({ error: 'Comprobante no encontrado o enlace inválido.' });
    }

    try {
      const bookings = await getAllBookings();
      const booking = bookings.find(b => String(b.id) === String(bookingId));
      if (!booking) {
        return res.status(404).json({ error: 'Comprobante no encontrado.' });
      }

      // El importe abonado se calcula aquí (nunca se acepta del navegador).
      const payments = await getPayments();
      const { totalPaid } = computeBookingPaymentStatus(booking, payments);

      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        booking: toPublicBooking(booking, {
          receiptToken: createReceiptToken(booking.id),
          paidAmount: totalPaid
        })
      });
    } catch (e) {
      console.warn('[Público] Error cargando recibo:', e?.message || e);
      return res.status(500).json({ error: 'No se pudo cargar el comprobante.' });
    }
  });
}
