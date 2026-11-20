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
import { isMongoConfigured, findMongoDocs, findMongoDoc, checkDistributedRateLimit } from './db/mongo.js';

const MAX_PUBLIC_RATE_LIMIT_ENTRIES = 2000;

/** Limitador con acotación de memoria y soporte distribuido en MongoDB Atlas para rutas públicas. */
function createPublicRateLimiter({ max = 90, windowMs = 10 * 60 * 1000, keySelector = null, distributedScope = null } = {}) {
  const hits = new Map();
  return async (req, res, next) => {
    const ip = getTrustedClientIp(req);
    const extraKey = typeof keySelector === 'function' ? String(keySelector(req) || '').trim() : '';
    const compositeKey = extraKey ? `${ip}:${extraKey}` : ip;
    const now = Date.now();

    if (hits.size > MAX_PUBLIC_RATE_LIMIT_ENTRIES) {
      for (const [k, v] of hits.entries()) {
        if (now > v.reset) hits.delete(k);
      }
      while (hits.size > MAX_PUBLIC_RATE_LIMIT_ENTRIES) {
        const oldest = hits.keys().next().value;
        if (!oldest) break;
        hits.delete(oldest);
      }
    }

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

    if (distributedScope && isMongoConfigured()) {
      try {
        const dist = await checkDistributedRateLimit({
          key: `pub:${distributedScope}:${compositeKey}`,
          maxAttempts: max,
          windowMs,
          failClosed: false
        });
        if (dist && dist.allowed === false) {
          res.setHeader('Retry-After', Math.ceil((dist.retryAfterMs || windowMs) / 1000));
          return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta más tarde.' });
        }
      } catch {}
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
  const scheduleLimiter = createPublicRateLimiter({
    max: 30,
    windowMs: 10 * 60 * 1000,
    distributedScope: 'schedule'
  });

  const INACTIVE_SCHEDULE_STATUSES = ['cancelled', 'canceled', 'cancelada', 'anulada', 'rejected'];
  const SCHEDULE_MAX_SLOTS = 500;

  /**
   * Consulta en MongoDB únicamente los campos mínimos para la agenda pública (`dateTime`, `status`),
   * excluyendo reservas canceladas desde el motor de base de datos y acotando el tamaño de respuesta.
   */
  async function getScheduleBookings() {
    const db = (typeof getRuntimeDB === 'function' ? getRuntimeDB() : null) || {};
    const merged = new Map();
    const inactiveSet = new Set(INACTIVE_SCHEDULE_STATUSES);

    for (const b of Array.isArray(db.bookings) ? db.bookings : []) {
      if (b?.id && b.dateTime && !inactiveSet.has(String(b.status || '').toLowerCase())) {
        merged.set(b.id, { id: b.id, dateTime: b.dateTime, status: b.status || 'pending' });
      }
    }

    if (isMongoConfigured()) {
      try {
        const mongoSlots = await findMongoDocs(
          'bookings',
          {
            dateTime: { $exists: true, $nin: [null, ''] },
            status: { $nin: INACTIVE_SCHEDULE_STATUSES }
          },
          { createdAt: -1 },
          SCHEDULE_MAX_SLOTS,
          { projection: { id: 1, dateTime: 1, status: 1, _id: 0 } }
        );
        if (Array.isArray(mongoSlots)) {
          for (const b of mongoSlots) {
            if (b?.dateTime) {
              const key = b.id || `${b.dateTime}:${b.status || 'pending'}`;
              merged.set(key, { dateTime: b.dateTime, status: b.status || 'pending' });
            }
          }
        }
      } catch (e) {
        console.warn('[Público] No se pudo leer agenda acotada de MongoDB:', e?.message || e);
      }
    }

    return [...merged.values()].slice(0, SCHEDULE_MAX_SLOTS);
  }

  /**
   * Consulta acotada por sufijo de teléfono (máx. 50 registros con proyección mínima)
   * para verificación de fidelidad y referidos sin descargar la colección completa.
   */
  async function getCustomerRecordsByPhoneSuffix(phoneSuffix = '') {
    const db = (typeof getRuntimeDB === 'function' ? getRuntimeDB() : null) || {};
    const inMemBookings = Array.isArray(db.bookings) ? [...db.bookings] : [];
    const inMemSessions = Array.isArray(db.sessions) ? [...db.sessions] : [];

    const safeDigits = String(phoneSuffix || '').replace(/\D/g, '').slice(-10);
    if (!isMongoConfigured() || safeDigits.length < 7) {
      return { bookings: inMemBookings, sessions: inMemSessions };
    }

    const suffix8 = safeDigits.slice(-8);
    // Patrón seguro de solo dígitos: permite coincidencia con formato +57 / espacios / guiones
    const digitsRegex = suffix8.split('').join('[^0-9]*') + '$';
    const bookingMap = new Map();
    for (const b of inMemBookings) {
      if (b?.id) bookingMap.set(b.id, b);
    }
    const sessionMap = new Map();
    for (const s of inMemSessions) {
      if (s?.token) sessionMap.set(s.token, s);
    }

    try {
      const [mongoBookings, mongoSessions] = await Promise.all([
        findMongoDocs(
          'bookings',
          { clientWhatsApp: { $regex: digitsRegex }, status: { $nin: INACTIVE_SCHEDULE_STATUSES } },
          { createdAt: -1 },
          50,
          { projection: { id: 1, clientName: 1, client_name: 1, clientWhatsApp: 1, status: 1, _id: 0 } }
        ),
        findMongoDocs(
          'sessions',
          { clientWhatsApp: { $regex: digitsRegex } },
          { createdAt: -1 },
          50,
          { projection: { id: 1, token: 1, clientName: 1, client_name: 1, clientWhatsApp: 1, status: 1, _id: 0 } }
        )
      ]);
      for (const b of Array.isArray(mongoBookings) ? mongoBookings : []) {
        if (b?.id) bookingMap.set(b.id, { ...(bookingMap.get(b.id) || {}), ...b });
      }
      for (const s of Array.isArray(mongoSessions) ? mongoSessions : []) {
        if (s?.token) sessionMap.set(s.token, { ...(sessionMap.get(s.token) || {}), ...s });
      }
    } catch (e) {
      console.warn('[Público] No se pudo consultar historial acotado por teléfono:', e?.message || e);
    }

    return { bookings: [...bookingMap.values()], sessions: [...sessionMap.values()] };
  }

  /** Obtiene una sola reserva por ID (memoria o MongoDB puntual, sin escanear la colección). */
  async function getSingleBookingById(bookingId) {
    const db = (typeof getRuntimeDB === 'function' ? getRuntimeDB() : null) || {};
    const inMem = (Array.isArray(db.bookings) ? db.bookings : []).find(b => b && String(b.id) === String(bookingId));
    if (isMongoConfigured()) {
      try {
        const mongoDoc = await findMongoDoc('bookings', { id: String(bookingId) });
        if (mongoDoc) {
          return inMem ? { ...inMem, ...mongoDoc } : mongoDoc;
        }
      } catch (e) {
        console.warn('[Público] No se pudo leer reserva puntual en MongoDB:', e?.message || e);
      }
    }
    return inMem || null;
  }

  /** Pagos asociados puntualmente a una reserva (sin descargar todos los pagos del estudio). */
  async function getPaymentsForBooking(bookingId) {
    const db = (typeof getRuntimeDB === 'function' ? getRuntimeDB() : null) || {};
    const targetId = String(bookingId || '');
    const inMem = (Array.isArray(db.payments) ? db.payments : []).filter(
      p => p && (String(p.bookingId || '') === targetId || String(p.sessionToken || '') === targetId)
    );
    if (isMongoConfigured() && targetId) {
      try {
        const mongoPayments = await findMongoDocs(
          'payments',
          { $or: [{ bookingId: targetId }, { sessionToken: targetId }] },
          { createdAt: -1 },
          100
        );
        if (Array.isArray(mongoPayments) && mongoPayments.length > 0) {
          const map = new Map();
          [...inMem, ...mongoPayments].forEach((p) => {
            if (p?.id) map.set(p.id, p);
          });
          return [...map.values()];
        }
      } catch (e) {
        console.warn('[Público] No se pudo leer payments puntuales de MongoDB:', e?.message || e);
      }
    }
    return inMem;
  }

  // ----------------------------------------------------------------------------
  // 1. CUPOS OCUPADOS DEL CALENDARIO (sin ningún dato personal ni IDs internos)
  // ----------------------------------------------------------------------------
  // Devuelve solo lo necesario para pintar el calendario: cuándo y estado.
  // Protege la privacidad omitiendo por completo los IDs internos y aplicando proyección + límite en MongoDB.
  app.get('/api/public/schedule', scheduleLimiter, async (req, res) => {
    try {
      const bookings = await getScheduleBookings();
      const slots = bookings
        .filter(b => b && b.dateTime)
        .filter(b => !INACTIVE_SCHEDULE_STATUSES.includes(String(b.status || '').toLowerCase()))
        .map(b => ({ dateTime: b.dateTime, status: b.status || 'pending' }));

      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.json({ slots });
    } catch (e) {
      console.warn('[Público] Error construyendo agenda:', e?.message || e);
      return res.status(500).json({ error: 'No se pudo cargar la agenda.' });
    }
  });

  // ----------------------------------------------------------------------------
  // 2. FIDELIDAD DEL CLIENTE (protegido contra enumeración: exige teléfono + coincidencia de nombre o token, rate limit 3/15m)
  // ----------------------------------------------------------------------------
  const loyaltyLimiter = createPublicRateLimiter({ max: 3, windowMs: 15 * 60 * 1000, distributedScope: 'loyalty' });
  const normalizeNameTokens = (nameStr) =>
    String(nameStr || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);

  app.get('/api/public/loyalty', loyaltyLimiter, async (req, res) => {
    const phone = String(req.query.phone || '').replace(/\D/g, '');
    const clientNameQuery = String(req.query.clientName || '').trim();
    const receiptTokenQuery = String(req.query.receiptToken || '').trim();
    const verifiedReceiptBookingId = receiptTokenQuery ? verifyReceiptToken(receiptTokenQuery) : null;
    // Deduplicar tokens de consulta para evitar bypass por repetición (ej. "Maria Maria")
    const queryNameTokens = [...new Set(normalizeNameTokens(clientNameQuery))];

    // Exigir al menos 10 dígitos y un factor de verificación adicional (nombre del titular o token firmado)
    // para impedir que terceros enumeren si un teléfono ha sido cliente del estudio.
    if (phone.length < 10 || (queryNameTokens.length === 0 && !verifiedReceiptBookingId)) {
      return res.json({ isLoyal: false, discountPercent: 0 });
    }

    const key = phone.slice(-8);
    const CANCELLED_STATUSES = new Set(['cancelled', 'cancelada', 'anulada', 'rejected']);
    const matches = (item) => {
      if (CANCELLED_STATUSES.has(String(item?.status || '').toLowerCase())) return false;
      const other = String(item?.clientWhatsApp || '').replace(/\D/g, '');
      const phoneMatches = other.length >= 8 && (other.endsWith(key) || key.endsWith(other.slice(-8)));
      if (!phoneMatches) return false;
      if (verifiedReceiptBookingId && String(item?.id) === String(verifiedReceiptBookingId)) {
        return true;
      }
      const storedTokens = [...new Set(normalizeNameTokens(item?.clientName || item?.client_name || ''))];
      if (storedTokens.length === 0 || queryNameTokens.length === 0) return false;
      // Hallazgo #18: Si el nombre registrado tiene 2 o más palabras (ej. "Mariana Gómez"),
      // exigir al menos 2 tokens ÚNICOS coincidentes para impedir enumeración con un solo nombre común.
      const matchedCount = queryNameTokens.filter((qt) => storedTokens.includes(qt)).length;
      const requiredMatches = storedTokens.length >= 2 ? 2 : 1;
      if (requiredMatches === 1) {
        return matchedCount >= 1 && storedTokens[0].length >= 4 && queryNameTokens[0] === storedTokens[0];
      }
      return matchedCount >= requiredMatches;
    };

    try {
      const { bookings, sessions } = await getCustomerRecordsByPhoneSuffix(phone);
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
  const referralLimiter = createPublicRateLimiter({ max: 10, windowMs: 10 * 60 * 1000, distributedScope: 'referral' });
  app.get('/api/public/referral', referralLimiter, async (req, res) => {
    const code = String(req.query.code || '');
    const clientPhone = String(req.query.clientPhone || '');

    try {
      const { bookings, sessions } = await getCustomerRecordsByPhoneSuffix(code);
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
      const booking = await getSingleBookingById(bookingId);
      if (!booking) {
        return res.status(404).json({ error: 'Comprobante no encontrado.' });
      }

      // El importe abonado se calcula aquí (nunca se acepta del navegador).
      const payments = await getPaymentsForBooking(booking.id);
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
