import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import {
  createAdminToken,
  requireAdminAuth,
  verifyAdminPin,
  isWeakConfiguredPin,
  createReceiptToken,
  readAdminToken,
  verifyAdminToken,
  KNOWN_WEAK_PIN_HASH
} from './security.js';
import { registerPublicRoutes } from './publicRoutes.js';
import { resolveBookingPrice } from './pricingGuard.js';
import {
  sendNewBookingEmails,
  sendBookingConfirmedEmail,
  sendPhotoDeliveryEmail,
  sendTwoFactorCodeEmail
} from './emailService.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ==============================================================================
// CONFIGURACIÓN Y CLIENTE ONESIGNAL PUSH 24/7
// ==============================================================================
// Las claves se leen EXCLUSIVAMENTE desde variables de entorno.
// Si no están configuradas, las notificaciones push se deshabilitan sin fallar.
// ==============================================================================
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';

if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.warn(
    '⚠️ [OneSignal] ONESIGNAL_APP_ID o ONESIGNAL_REST_API_KEY no configuradas. ' +
    'Las notificaciones push estarán deshabilitadas.'
  );
}

async function sendOneSignalPush({ title, message, url = 'https://sebastiang.app/?mode=admin', data = {} }) {
  if (!ONESIGNAL_REST_API_KEY || !ONESIGNAL_APP_ID) {
    console.warn('[OneSignal] Push omitido: credenciales no configuradas.');
    return null;
  }
  try {
    const payload = JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      included_segments: ['Total Subscriptions', 'Subscribed Users'],
      headings: { es: title, en: title },
      contents: { es: message, en: message },
      url: url,
      priority: 10,
      data
    });

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`
      },
      body: payload
    });
    const resJson = await response.json();
    console.log('OneSignal Push enviado:', resJson);
    return resJson;
  } catch (err) {
    console.warn('Error al disparar OneSignal Push:', err);
    return null;
  }
}

// ==============================================================================
// SUPABASE CLOUD (Fuente canónica de verdad)
// ==============================================================================
const SUPABASE_REST_URL = process.env.SUPABASE_REST_URL || 'https://maqqzcawbdhhfqxoabyq.supabase.co';
const SUPABASE_REST_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_REST_KEY || '';

if (!SUPABASE_REST_KEY) {
  console.warn(
    '⚠️ [Supabase] SUPABASE_REST_KEY no configurada. ' +
    'La sincronización con la nube estará limitada.'
  );
}

async function syncBookingToSupabaseServer(b) {
  if (!b || !b.id || !SUPABASE_REST_KEY) return;
  const supaId = b.id.startsWith('book-') ? b.id : `book-${b.id}`;
  try {
    await fetch(`${SUPABASE_REST_URL}/rest/v1/bookings`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_REST_KEY,
        'Authorization': `Bearer ${SUPABASE_REST_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: supaId,
        client_name: b.clientName || 'Cliente',
        client_whatsapp: b.clientWhatsApp || '',
        client_email: b.clientEmail || '',
        package_id: b.packageId || 'pkg-4fotos',
        package_name: b.packageName || 'Sesión Fotográfica',
        total_price: Number(b.totalPrice || 0),
        location_type: b.locationType || 'san_antero',
        specific_location: b.specificLocation || '',
        date_time: b.dateTime || '',
        description: b.description || '',
        status: b.status || 'pending'
      })
    });
    await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_REST_KEY,
        'Authorization': `Bearer ${SUPABASE_REST_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: supaId,
        title: b.clientName || 'Reserva',
        category: 'booking_data',
        location: b.specificLocation || '',
        url: JSON.stringify(b)
      })
    });
  } catch (e) {
    console.warn('Sync server -> Supabase:', e);
  }
}

// ==============================================================================
// RATE LIMITER EN MEMORIA (Anti-Brute-Force)
// ==============================================================================
const loginAttempts = new Map(); // IP -> { count, windowStart, lockedUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOGIN_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutos

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record) return { allowed: true };

  // Si el bloqueo expiró, limpiar
  if (record.lockedUntil && now > record.lockedUntil) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  // Si está bloqueado
  if (record.lockedUntil && now < record.lockedUntil) {
    return {
      allowed: false,
      retryAfterMs: record.lockedUntil - now,
      retryAfterMin: Math.ceil((record.lockedUntil - now) / 60000)
    };
  }

  // Si la ventana expiró, resetear
  if (record.windowStart && now - record.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  return { allowed: true, attempts: record.count };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, windowStart: now, lockedUntil: 0 };

  record.count += 1;
  if (!record.windowStart) record.windowStart = now;

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOGIN_LOCKOUT_MS;
    record.count = 0;
    record.windowStart = 0;
  }

  loginAttempts.set(ip, record);
  return record;
}

function resetLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// Limpieza periódica de entradas antiguas del rate limiter (cada 10 min)
const limpiezaPeriodica = setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts.entries()) {
    if (record.lockedUntil && now > record.lockedUntil + LOGIN_WINDOW_MS) {
      loginAttempts.delete(ip);
    } else if (!record.lockedUntil && record.windowStart && now - record.windowStart > LOGIN_WINDOW_MS * 2) {
      loginAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000);
// En serverless un temporizador activo mantiene la instancia viva. Con unref() la
// limpieza sigue funcionando mientras la instancia atiende peticiones, pero no
// impide que el proceso termine (era la causa del cuelgue al cargar el modulo).
if (typeof limpiezaPeriodica.unref === 'function') limpiezaPeriodica.unref();

// ==============================================================================
// HASHING Y COMPARACIÓN SEGURA
// ==============================================================================
// El hash del PIN conocido "0493" se conserva SOLO para avisar al arrancar
// (ver isWeakConfiguredPin en ./security.js). Nunca se usa como valor válido.

function hashSHA256(str) {
  return crypto.createHash('sha256').update(String(str || '').trim()).digest('hex');
}

// Comparación en tiempo constante (anti-timing-attack)
function secureCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ==============================================================================
// SESIONES DE ADMINISTRADOR
// ==============================================================================
// La emisión y verificación de tokens vive en ./security.js (HMAC-SHA256 con
// ADMIN_AUTH_SECRET obligatorio y fallo cerrado). Aquí existía un emisor duplicado
// con un secreto por defecto público ('fallback-dev-secret-change-me'): se eliminó
// para que nadie pueda volver a firmar sesiones con un secreto conocido.
// ==============================================================================

// ==============================================================================
// BASE DE DATOS EN MEMORIA (Cache sincronizado con Supabase)
// ==============================================================================
// NOTA: Ya NO se usa /tmp/db.json. En Vercel serverless /tmp se pierde entre
// cold starts. Supabase Cloud es la fuente canónica de verdad.
// ==============================================================================
function getDefaultDB() {
  return {
    settings: {
      photographerName: "Sebastian G",
      photographerWhatsApp: "+573244725167",
      photographerWhatsApp2: "+573023696513",
      outOfSanAnteroSurcharge: 10000,
      currencySymbol: "$",
      tagline: "Capturamos momentos, creamos recuerdos. ♡",
      watermarkText: "SEBASTIAN G",
      watermarkSubtext: "MUESTRA EXCLUSIVA • PROHIBIDA SU DESCARGA",
      watermarkLogoUrl: "/app-icon.png",
      adminPinHash: '', // Sin PIN por defecto: se define en ADMIN_PIN_SCRYPT / ADMIN_PIN_HASH
      printedPhotoPrice: 7000,
      printedPhoto15x20Price: 8000,
      printedPhoto20x30Price: 30000,
      printedPhoto30x45Price: 60000,
      printedPhoto40x50Price: 85000,
      printedPhoto50x70Price: 110000,
      printedPhoto70x50Price: 120000,
      printedPhoto70x100Price: 200000,
      retabloCost20x30: 15000,
      retabloCost30x45: 30000,
      retabloCost40x50: 55000,
      retabloCost50x70: 80000,
      retabloCost70x50: 80000,
      retabloCost70x100: 150000
    },
    packages: [
      {
        id: "pkg-4fotos", name: "4 Fotos Digitales", price: 45000,
        photoCount: 4, freePhotos: 2, totalPhotos: 6,
        duration: "45 minutos", outfits: "1 a 2 cambios",
        description: "Ideal para fotos individuales, retratos en playa o sesión casual.",
        features: [
          "4 Fotos Digitales en Alta Calidad",
          "+ 2 Fotos GRATIS incluidas (Total: 6 fotos)",
          "Edición y retoque profesional",
          "Atención personalizada",
          "Enlace privado de WhatsApp para elegir tus favoritas"
        ],
        popular: false
      },
      {
        id: "pkg-6fotos", name: "6 Fotos Digitales", price: 65000,
        photoCount: 6, freePhotos: 2, totalPhotos: 8,
        duration: "1 hora", outfits: "2 cambios de vestuario",
        description: "Perfecto para parejas, cumpleaños o retratos con variedad de poses.",
        features: [
          "6 Fotos Digitales en Alta Calidad",
          "+ 2 Fotos GRATIS incluidas (Total: 8 fotos)",
          "Edición y retoque profesional",
          "Atención personalizada",
          "Enlace privado de WhatsApp con 3 días para seleccionar"
        ],
        popular: false
      },
      {
        id: "pkg-8fotos", name: "8 Fotos Digitales", price: 75000,
        photoCount: 8, freePhotos: 2, totalPhotos: 10,
        duration: "1 hora y media", outfits: "2 a 3 cambios",
        description: "Nuestra opción favorita para familias, quinceañeras y atardeceres frente al mar.",
        features: [
          "8 Fotos Digitales en Alta Calidad",
          "+ 2 Fotos GRATIS incluidas (Total: 10 fotos)",
          "Edición profesional detallada",
          "Asesoría de poses en locación",
          "Selección exclusiva mediante enlace protegido"
        ],
        popular: true
      },
      {
        id: "pkg-10fotos", name: "10 Fotos Digitales", price: 85000,
        photoCount: 10, freePhotos: 2, totalPhotos: 12,
        duration: "Hasta 2 horas", outfits: "Cambios ilimitados",
        description: "Cobertura completa con fotos variadas de plano entero, medio cuerpo y primeros planos.",
        features: [
          "10 Fotos Digitales en Alta Calidad",
          "+ 2 Fotos GRATIS incluidas (Total: 12 fotos)",
          "Edición y colorización profesional cinematográfica",
          "Prioridad de entrega",
          "Opción de añadir impresiones 10x15 a $7.000 o 15x20 a $8.000 c/u"
        ],
        popular: false
      }
    ],
    catalog: [],
    bookings: [],
    payments: [],
    sessions: [],
    reviews: [],
    walletBalances: { nequi: 0, daviplata: 0, dale: 0 }
  };
}

let runtimeDB = getDefaultDB();

// ------------------------------------------------------------------------------
// RUTAS PÚBLICAS ACOTADAS (calendario, fidelidad y recibo por token)
// Se registran ANTES del middleware de administración: el sitio público no
// debe necesitar sesión, pero tampoco recibe ningún dato personal.
// ------------------------------------------------------------------------------
registerPublicRoutes(app, {
  getRuntimeDB: () => runtimeDB,
  supabase: { url: SUPABASE_REST_URL, key: SUPABASE_REST_KEY }
});

// ==============================================================================
// ENDPOINTS PÚBLICOS
// ==============================================================================

app.post('/api/send-push', requireAdminAuth, async (req, res) => {
  const { title, message, url, data } = req.body || {};
  if (!title || !message) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (title, message)' });
  }
  const result = await sendOneSignalPush({ title, message, url, data });
  res.json({ success: true, result });
});

app.get('/api/settings', (req, res) => {
  const { adminPin, adminPinHash, ...publicSettings } = runtimeDB.settings || {};
  res.json(publicSettings);
});

app.get('/api/catalog', (req, res) => {
  res.json(runtimeDB.catalog || []);
});

app.get('/api/packages', (req, res) => {
  res.json(runtimeDB.packages || []);
});

app.get('/api/reviews', (req, res) => {
  res.json(runtimeDB.reviews || []);
});

app.post('/api/gallery/:token/review', (req, res) => {
  const { token } = req.params;
  const { clientName, sessionTitle, rating, comment, recommend } = req.body;
  const newReview = {
    id: `rev-${Date.now()}`,
    token,
    clientName: (clientName || 'Cliente').trim(),
    sessionTitle: sessionTitle || 'Sesión Fotográfica',
    rating: Number(rating) || 5,
    recommend: recommend !== false,
    comment: (comment || '').trim(),
    date: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    verified: true
  };
  if (!runtimeDB.reviews) runtimeDB.reviews = [];
  runtimeDB.reviews.unshift(newReview);

  sendOneSignalPush({
    title: '⭐ ¡Nueva Reseña de Cliente!',
    message: `${newReview.clientName} (${newReview.rating}★): "${(newReview.comment || 'Excelente sesión').slice(0, 60)}"`,
    url: 'https://sebastiang.app/?mode=admin',
    data: { type: 'review' }
  }).catch(() => {});

  res.json({ success: true, review: newReview });
});

app.get('/api/admin/wallets', (req, res) => {
  res.json(runtimeDB.walletBalances || { nequi: 0, daviplata: 0, dale: 0 });
});

app.post('/api/admin/wallets', (req, res) => {
  const balances = req.body;
  if (balances && typeof balances === 'object') {
    runtimeDB.walletBalances = { ...runtimeDB.walletBalances, ...balances };
  }
  res.json({ success: true, walletBalances: runtimeDB.walletBalances });
});

app.post('/api/packages', requireAdminAuth, (req, res) => {
  const { packages } = req.body;
  if (Array.isArray(packages)) {
    runtimeDB.packages = packages;
  }
  res.json({ success: true, packages: runtimeDB.packages });
});

app.post('/api/settings', requireAdminAuth, (req, res) => {
  const newSettings = req.body;
  if (newSettings && typeof newSettings === 'object') {
    // Nunca permitir que se sobreescriba el hash del PIN por este endpoint
    const { adminPin, adminPinHash, ...safeSettings } = newSettings;
    runtimeDB.settings = { ...runtimeDB.settings, ...safeSettings };
  }
  res.json({ success: true, settings: runtimeDB.settings });
});

app.post('/api/bookings', async (req, res) => {
  const {
    clientName, clientWhatsApp, clientEmail, packageId,
    locationType, specificLocation, dateTime, description,
    totalPrice, printedPhotosCount, printedPhotos10x15Count,
    printedPhotos15x20Count, retablosCount, printedSizes,
    paperPhotosSummary, retablosSummary, printedPhotosSummary
  } = req.body;

  const pkg = runtimeDB.packages.find(p => p.id === packageId) || runtimeDB.packages[0];

  // El precio lo decide el SERVIDOR entre un mínimo y un máximo legítimos:
  //  - se ignoran los valores manipulados (por ejemplo reservar por $1),
  //  - se respetan las combinaciones válidas (impresiones, retablos, fidelidad),
  //  - el descuento de recurrencia se comprueba aquí, no en el navegador.
  const { finalPrice, band, priceCheck } = resolveBookingPrice({ db: runtimeDB, pkg, body: req.body });
  if (priceCheck.adjusted) {
    console.warn(`[Precios] Corregido (${priceCheck.reason}) para ${clientName || 'cliente sin nombre'}: banda ${band.minPrice}-${band.listPrice}`);
  }

  const bookingId = `book-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const receiptToken = createReceiptToken(bookingId);

  const newBooking = {
    id: bookingId,
    clientName: (clientName || 'Cliente').trim(),
    clientWhatsApp: (clientWhatsApp || '').trim(),
    clientEmail: (clientEmail || '').trim(),
    packageId: pkg.id,
    packageName: pkg.name,
    totalPrice: finalPrice,
    locationType: locationType === 'outside' ? 'outside_san_antero' : 'san_antero',
    specificLocation: (specificLocation || '').trim(),
    dateTime,
    description: (description || '').trim(),
    printedPhotosCount: Number(printedPhotosCount) || 0,
    printedPhotos10x15Count: Number(printedPhotos10x15Count) || 0,
    printedPhotos15x20Count: Number(printedPhotos15x20Count) || 0,
    retablosCount: Number(retablosCount) || 0,
    printedSizes: printedSizes || {},
    paperPhotosSummary: paperPhotosSummary || '',
    retablosSummary: retablosSummary || '',
    printedPhotosSummary: printedPhotosSummary || '',
    receiptToken,
    createdAt: new Date().toISOString(),
    status: 'pending',
    isReal: true
  };

  runtimeDB.bookings.unshift(newBooking);

  // En Vercel Serverless, res.json() congela el proceso inmediatamente y descarta
  // cualquier promesa no resuelta. Es mandatorio esperar la sincronización a la nube,
  // el envío de correos y la notificación push con Promise.allSettled antes de responder:
  const backgroundTasks = [
    syncBookingToSupabaseServer(newBooking).catch(e => {
      console.warn('Supabase sync server error:', e?.message || e);
      return null;
    }),
    sendNewBookingEmails(newBooking, runtimeDB.settings).catch(err => {
      console.error('Error enviando correos de nueva reserva:', err?.message || err);
      return null;
    }),
    sendOneSignalPush({
      title: '📸 ¡Nueva Reserva Recibida!',
      message: `${newBooking.clientName} ha reservado ${newBooking.packageName} (${newBooking.dateTime})`,
      url: 'https://sebastiang.app/?mode=admin',
      data: { type: 'booking', bookingId: newBooking.id }
    }).catch(err => {
      console.error('Error OneSignal Push reserva:', err?.message || err);
      return null;
    })
  ];

  await Promise.allSettled(backgroundTasks);

  const photogWhatsApp1 = (runtimeDB.settings.photographerWhatsApp || '+573244725167').replace(/\D/g, '');
  const photogWhatsApp2 = (runtimeDB.settings.photographerWhatsApp2 || '+573023696513').replace(/\D/g, '');
  const msgText = encodeURIComponent(
    `📸 *¡Hola Sebastian G! Acabo de hacer una reserva en tu sitio web:*\n` +
    `👤 *Nombre:* ${newBooking.clientName}\n` +
    `📱 *WhatsApp:* ${newBooking.clientWhatsApp}\n` +
    (newBooking.clientEmail ? `✉️ *Correo:* ${newBooking.clientEmail}\n` : '') +
    `📦 *Paquete:* ${newBooking.packageName} ($${newBooking.totalPrice.toLocaleString('es-CO')} COP)\n` +
    (newBooking.paperPhotosSummary ? `🖼️ *Fotos Impresas (Papel):* ${newBooking.paperPhotosSummary}\n` : '') +
    (newBooking.retablosSummary ? `🪵 *Cuadros en Retablo:* ${newBooking.retablosSummary}\n` : (!newBooking.paperPhotosSummary && newBooking.printedPhotosSummary ? `🖼️ *Fotos Impresas / Cuadros:* ${newBooking.printedPhotosSummary}\n` : '')) +
    `📍 *Lugar:* ${newBooking.locationType === 'outside_san_antero' ? 'Locación Especial / Fuera (' + newBooking.specificLocation + ')' : 'Sesión Local (' + newBooking.specificLocation + ')'}\n` +
    `🗓️ *Fecha y Hora:* ${newBooking.dateTime}\n` +
    `📝 *Detalles:* ${newBooking.description || 'Sin notas adicionales'}`
  );

  res.status(201).json({
    success: true,
    booking: newBooking,
    receiptToken,
    directWhatsAppUrl: `https://wa.me/${photogWhatsApp1}?text=${msgText}`,
    secondaryWhatsAppUrl: `https://wa.me/${photogWhatsApp2}?text=${msgText}`
  });
});

app.post('/api/send-email', requireAdminAuth, async (req, res) => {
  const { type, data } = req.body || {};
  try {
    if (type === '2fa_code') {
      const ok = await sendTwoFactorCodeEmail(data?.code, data?.targetEmail);
      return res.json({ success: ok, message: ok ? 'Código de seguridad 2FA enviado por correo' : 'No se pudo enviar el correo' });
    } else if (type === 'booking_confirmation') {
      const ok = await sendBookingConfirmedEmail(data.booking, data.customNotes);
      return res.json({ success: ok, message: ok ? 'Correo de confirmación enviado' : 'No se pudo enviar el correo' });
    } else if (type === 'photo_delivery') {
      const ok = await sendPhotoDeliveryEmail(data);
      return res.json({ success: ok, message: ok ? 'Fotos enviadas por correo al cliente' : 'No se pudo enviar el correo' });
    } else if (type === 'test') {
      const ok = await sendNewBookingEmails(data?.booking || {
        clientName: 'Cliente de Prueba',
        clientWhatsApp: '+57 300 000 0000',
        clientEmail: 'reservas@sebastiang.app',
        packageName: '8 Fotos Digitales',
        dateTime: 'Hoy a las 4:00 PM',
        specificLocation: 'Playa San Antero',
        totalPrice: 75000
      }, runtimeDB.settings);
      return res.json({ success: true, message: 'Correo de prueba enviado con éxito' });
    }
    return res.status(400).json({ error: 'Tipo de correo no soportado' });
  } catch (err) {
    console.error('Error en /api/send-email:', err);
    return res.status(500).json({ error: err.message || 'Error interno al enviar correo' });
  }
});

app.get('/api/gallery/:token', async (req, res) => {
  const { token } = req.params;
  let session = (runtimeDB.sessions || []).find(s => s.token === token);

  if (!session && token === 'demo-cliente-2026') {
    session = {
      id: "sess-demo",
      token: "demo-cliente-2026",
      clientName: "Demostración de Selección",
      clientWhatsApp: "+573244725167",
      packageTitle: "8 Fotos Digitales (+ 2 Fotos Gratis)",
      maxPhotosAllowed: 10,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "pending",
      submittedAt: null,
      photos: [
        { id: "photo-1", title: "Foto 001 - Retrato Primer Plano", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-2", title: "Foto 002 - Mirada al Atardecer", url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-3", title: "Foto 003 - Sonrisa en la Orilla", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-4", title: "Foto 004 - Movimiento y Brisa", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-5", title: "Foto 005 - Plano Entero en la Playa", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-6", title: "Foto 006 - Silueta en Contraluz", url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" }
      ]
    };
  }

  if (!session && token !== 'demo-cliente-2026' && SUPABASE_REST_KEY) {
    try {
      const supaRes = await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog?id=eq.sess-${encodeURIComponent(token)}&select=*`, {
        headers: { 'apikey': SUPABASE_REST_KEY, 'Authorization': `Bearer ${SUPABASE_REST_KEY}` }
      });
      if (supaRes.ok) {
        const rows = await supaRes.json();
        if (rows && rows.length > 0 && rows[0].url) {
          session = JSON.parse(rows[0].url);
          runtimeDB.sessions = runtimeDB.sessions || [];
          runtimeDB.sessions.push(session);
        }
      }
    } catch (errSupa) {
      console.warn('Error consultando sesión en Supabase:', errSupa);
    }
  }

  if (!session) return res.status(404).json({ error: 'Galería no encontrada.' });

  const now = Date.now();
  const expiresTime = new Date(session.expiresAt).getTime();
  const isExpired = now > expiresTime;
  const isSubmitted = session.status === 'submitted' || session.status === 'delivered';
  const isDelivered = session.status === 'delivered';

  res.json({
    ...session,
    isExpired,
    isSubmitted,
    isDelivered,
    watermarkSettings: {
      watermarkText: runtimeDB.settings.watermarkText,
      watermarkSubtext: runtimeDB.settings.watermarkSubtext,
      watermarkLogoUrl: runtimeDB.settings.watermarkLogoUrl
    }
  });
});

app.post('/api/gallery/:token/live-selection', async (req, res) => {
  try {
    const { token } = req.params;
    const { selections, selectedCount } = req.body || {};
    let session = (runtimeDB.sessions || []).find(s => s.token === token);

    if (!session && SUPABASE_REST_KEY) {
      const supaRes = await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog?id=eq.sess-${encodeURIComponent(token)}&select=*`, {
        headers: { 'apikey': SUPABASE_REST_KEY, 'Authorization': `Bearer ${SUPABASE_REST_KEY}` }
      });
      if (supaRes.ok) {
        const rows = await supaRes.json();
        if (rows && rows.length > 0 && rows[0].url) {
          session = JSON.parse(rows[0].url);
          runtimeDB.sessions = runtimeDB.sessions || [];
          runtimeDB.sessions.push(session);
        }
      }
    }

    if (session) {
      if (Array.isArray(selections)) {
        const selMap = new Map();
        selections.forEach(item => {
          selMap.set(item.id, {
            selected: Boolean(item.selected),
            comment: (item.clientComment || '').trim()
          });
        });
        session.photos = (session.photos || []).map(p => {
          const update = selMap.get(p.id);
          if (update) return { ...p, selected: update.selected, clientComment: update.comment };
          return p;
        });
      }
      session.selectedCount = selectedCount || (session.photos ? session.photos.filter(p => p.selected).length : 0);
      session.lastSelectionUpdate = new Date().toISOString();

      if (SUPABASE_REST_KEY) {
        await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog?id=eq.sess-${encodeURIComponent(token)}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_REST_KEY,
            'Authorization': `Bearer ${SUPABASE_REST_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: JSON.stringify(session) })
        });
      }
    }
    res.json({ success: true, selectedCount: session?.selectedCount || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gallery/:token/submit', async (req, res) => {
  const { token } = req.params;
  const { selections } = req.body;
  let session = (runtimeDB.sessions || []).find(s => s.token === token);

  if (!session && SUPABASE_REST_KEY) {
    try {
      const supaRes = await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog?id=eq.sess-${encodeURIComponent(token)}&select=*`, {
        headers: { 'apikey': SUPABASE_REST_KEY, 'Authorization': `Bearer ${SUPABASE_REST_KEY}` }
      });
      if (supaRes.ok) {
        const rows = await supaRes.json();
        if (rows && rows.length > 0 && rows[0].url) {
          session = JSON.parse(rows[0].url);
          runtimeDB.sessions = runtimeDB.sessions || [];
          runtimeDB.sessions.push(session);
        }
      }
    } catch (errSupa) {}
  }

  if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });
  if (session.status === 'submitted') {
    return res.status(403).json({ error: 'Esta selección ya fue enviada previamente y se encuentra bloqueada.' });
  }

  const selMap = new Map();
  (selections || []).forEach(item => {
    selMap.set(item.id, {
      selected: Boolean(item.selected),
      comment: (item.clientComment || '').trim()
    });
  });
  session.photos = session.photos.map(p => {
    const update = selMap.get(p.id);
    if (update) return { ...p, selected: update.selected, clientComment: update.comment };
    return p;
  });
  session.status = 'submitted';
  session.submittedAt = new Date().toISOString();
  const selectedPhotos = session.photos.filter(p => p.selected);
  session.selectedCount = selectedPhotos.length;

  if (SUPABASE_REST_KEY) {
    try {
      await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog?id=eq.sess-${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_REST_KEY,
          'Authorization': `Bearer ${SUPABASE_REST_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: JSON.stringify(session) })
      });
    } catch (errSupa) {
      console.warn('Error al actualizar selección en Supabase:', errSupa);
    }
  }

  let summary = `📸 *¡Hola Sebastian G! Ya elegí las fotos de mi sesión:*\n`;
  summary += `👤 *Cliente:* ${session.clientName}\n`;
  summary += `📦 *Sesión:* ${session.packageTitle}\n`;
  summary += `🔢 *Total Elegidas:* ${selectedPhotos.length} fotos\n`;
  summary += `*Lista de fotos seleccionadas:*\n`;
  selectedPhotos.forEach((p, idx) => {
    summary += `\n${idx + 1}. *${p.title}*`;
    if (p.clientComment) {
      summary += `\n💬 _Nota:_ "${p.clientComment}"`;
    }
  });
  summary += `\n_Quedo atento a la entrega final en alta resolución. ¡Muchas gracias!_`;

  const photogWhatsApp1 = (runtimeDB.settings.photographerWhatsApp || '+573244725167').replace(/\D/g, '');
  const photogWhatsApp2 = (runtimeDB.settings.photographerWhatsApp2 || '+573023696513').replace(/\D/g, '');
  const directWhatsAppUrl = `https://wa.me/${photogWhatsApp1}?text=${encodeURIComponent(summary)}`;
  const secondaryWhatsAppUrl = `https://wa.me/${photogWhatsApp2}?text=${encodeURIComponent(summary)}`;

  sendOneSignalPush({
    title: `📸 ¡${session.clientName || 'Cliente'} envió sus fotos!`,
    message: `Eligió ${selectedPhotos.length} fotos de su paquete "${session.packageTitle}". ¡Lista para procesar!`,
    url: 'https://sebastiang.app/?mode=admin',
    data: { type: 'session', targetTab: 'sessions', token: session.token }
  }).catch(err => console.error('Error OneSignal Push selección:', err));

  res.json({
    success: true,
    message: '¡Selección guardada y bloqueada con éxito!',
    selectedCount: selectedPhotos.length,
    directWhatsAppUrl,
    secondaryWhatsAppUrl,
    summary
  });
});

// ==============================================================================
// AUTENTICACIÓN ADMIN (HARDENED CON RATE LIMITING Y TIEMPO CONSTANTE)
// ==============================================================================
app.post('/api/admin/auth', (req, res) => {
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip);

  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Demasiados intentos. Bloqueado por ${rateCheck.retryAfterMin} minutos.`,
      retryAfterMs: rateCheck.retryAfterMs
    });
  }

  const { pin } = req.body;
  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ error: 'PIN requerido.' });
  }

  // Verificación del PIN en el SERVIDOR (el navegador ya no conoce el hash).
  // Prioridad:
  // 1. ADMIN_PIN_SCRYPT (scrypt robusto de 8+ caracteres, recomendado)
  // 2. ADMIN_PIN_HASH (SHA-256 explícito en variables de entorno)
  // 3. Fallback a 0493 únicamente si aún no se configuró ninguna variable en Vercel
  const hasConfiguredPin = Boolean(process.env.ADMIN_PIN_SCRYPT || process.env.ADMIN_PIN_HASH || runtimeDB.settings.adminPinHash);
  const effectiveSha = process.env.ADMIN_PIN_HASH || runtimeDB.settings.adminPinHash || (!hasConfiguredPin ? KNOWN_WEAK_PIN_HASH : '');

  if (!hasConfiguredPin || isWeakConfiguredPin(effectiveSha)) {
    console.warn('⚠️ [Seguridad] No se ha configurado un PIN robusto aún. Usa ADMIN_PIN_SCRYPT para activar tu nuevo PIN.');
  }

  const pinOk = verifyAdminPin(pin, {
    scryptHash: process.env.ADMIN_PIN_SCRYPT,
    sha256Hash: effectiveSha
  });

  if (!pinOk) {
    const newRecord = recordFailedLogin(ip);
    const remaining = MAX_LOGIN_ATTEMPTS - newRecord.count;

    if (newRecord.lockedUntil) {
      return res.status(429).json({
        error: 'Cuenta bloqueada temporalmente por demasiados intentos fallidos.',
        lockedUntil: newRecord.lockedUntil
      });
    }

    return res.status(401).json({
      error: 'PIN incorrecto.',
      attemptsRemaining: Math.max(0, remaining)
    });
  }

  // Login exitoso: token firmado (HMAC-SHA256), no un texto fijo.
  resetLoginAttempts(ip);
  try {
    const token = createAdminToken();
    return res.json({ success: true, token, expiresInMs: 12 * 60 * 60 * 1000 });
  } catch (e) {
    console.error('[Seguridad] No se pudo emitir la sesión:', e?.message || e);
    return res.status(503).json({ error: 'El servidor no tiene configurado ADMIN_AUTH_SECRET.' });
  }
});

// ==============================================================================
// A PARTIR DE AQUÍ, TODO /api/admin/* EXIGE UNA SESIÓN FIRMADA VÁLIDA
// ==============================================================================
app.use('/api/admin', (req, res, next) => {
  if (req.path === '/auth') return next();
  return requireAdminAuth(req, res, next);
});

app.get('/api/admin/bookings', async (req, res) => {
  try {
    const map = new Map();
    (runtimeDB.bookings || []).forEach(b => { if (b && b.id) map.set(b.id, { ...b, isReal: true }); });

    if (SUPABASE_REST_KEY) {
      try {
        const supaRes = await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog?category=eq.booking_data&select=*`, {
          headers: { 'apikey': SUPABASE_REST_KEY, 'Authorization': `Bearer ${SUPABASE_REST_KEY}` }
        });
        if (supaRes.ok) {
          const rows = await supaRes.json();
          if (Array.isArray(rows)) {
            rows.forEach(r => {
              try {
                const b = JSON.parse(r.url);
                if (b && b.id) {
                  const existing = map.get(b.id);
                  map.set(b.id, existing ? { ...existing, ...b, isReal: true } : { ...b, isReal: true });
                }
              } catch (err) {}
            });
          }
        }
      } catch (errCloud) {
        console.warn('Error recuperando reservas de Supabase catalog:', errCloud);
      }

      try {
        const supaBookingsRes = await fetch(`${SUPABASE_REST_URL}/rest/v1/bookings?select=*`, {
          headers: { 'apikey': SUPABASE_REST_KEY, 'Authorization': `Bearer ${SUPABASE_REST_KEY}` }
        });
        if (supaBookingsRes.ok) {
          const rows = await supaBookingsRes.json();
          if (Array.isArray(rows)) {
            rows.forEach(b => {
              if (b && b.id) {
                const formatted = {
                  id: b.id,
                  clientName: b.client_name,
                  clientWhatsApp: b.client_whatsapp,
                  clientEmail: b.client_email,
                  packageId: b.package_id,
                  packageName: b.package_name,
                  totalPrice: Number(b.total_price || 0),
                  locationType: b.location_type,
                  specificLocation: b.specific_location,
                  dateTime: b.date_time,
                  description: b.description,
                  status: b.status,
                  createdAt: b.created_at,
                  isReal: true
                };
                const existing = map.get(b.id);
                map.set(b.id, existing ? { ...existing, ...formatted, isReal: true } : formatted);
              }
            });
          }
        }
      } catch (errDirect) {
        console.warn('Error recuperando reservas de Supabase bookings:', errDirect);
      }
    }

    runtimeDB.bookings = Array.from(map.values());
  } catch (e) {
    console.warn('Error en /api/admin/bookings:', e);
  }
  // Se añade un token firmado por reserva para los comprobantes públicos,
  // de modo que el recibo no dependa de que el navegador descargue el CRM.
  const bookingsWithReceiptToken = (runtimeDB.bookings || []).map(b => ({
    ...b,
    receiptToken: createReceiptToken(b.id)
  }));
  res.json(bookingsWithReceiptToken);
});

app.patch('/api/admin/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  let booking = (runtimeDB.bookings || []).find(b => b.id === id);
  if (!booking) {
    booking = { id, ...updates, isReal: true };
    if (!runtimeDB.bookings) runtimeDB.bookings = [];
    runtimeDB.bookings.unshift(booking);
  } else {
    Object.assign(booking, updates, { isReal: true });
  }
  await syncBookingToSupabaseServer(booking).catch(e => console.warn('Supabase sync server error:', e));
  res.json({ success: true, booking });
});

app.delete('/api/admin/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const supaId = id.startsWith('book-') ? id : `book-${id}`;
  runtimeDB.bookings = (runtimeDB.bookings || []).filter(b => b.id !== id && b.id !== supaId);

  if (SUPABASE_REST_KEY) {
    try {
      await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog?id=eq.${encodeURIComponent(supaId)}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_REST_KEY, 'Authorization': `Bearer ${SUPABASE_REST_KEY}` }
      });
      await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_REST_KEY, 'Authorization': `Bearer ${SUPABASE_REST_KEY}` }
      });
      await fetch(`${SUPABASE_REST_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(supaId)}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_REST_KEY, 'Authorization': `Bearer ${SUPABASE_REST_KEY}` }
      });
      await fetch(`${SUPABASE_REST_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_REST_KEY, 'Authorization': `Bearer ${SUPABASE_REST_KEY}` }
      });
    } catch (e) {}
  }
  res.json({ success: true });
});

// ==============================================================================
// PASARELAS DE PAGO
// ==============================================================================
app.get('/api/admin/payments', (req, res) => {
  res.json(runtimeDB.payments || []);
});

app.post('/api/payments', (req, res) => {
  const {
    clientName, clientWhatsApp, sessionToken, packageTitle, amount, method,
    reference, voucherUrl, extraPhotosCount, printedPhotosCount,
    printedPhotos10x15Count, printedPhotos15x20Count, retablosCount,
    printedSizes, paperPhotosSummary, retablosSummary, printedPhotosSummary,
    status, concept
  } = req.body;

  // Solo un administrador con sesión válida puede dar por verificado un pago.
  // Un cliente anónimo puede registrar su comprobante, pero siempre queda pendiente.
  const isAdminCaller = Boolean(verifyAdminToken(readAdminToken(req)));

  const newPayment = {
    id: `pay-${Date.now()}`,
    clientName: (clientName || 'Cliente').trim(),
    clientWhatsApp: (clientWhatsApp || '').trim(),
    sessionToken: sessionToken || '',
    packageTitle: packageTitle || 'Sesión Fotográfica',
    amount: Number(amount) || 0,
    method: method || 'nequi',
    reference: (reference || '').trim(),
    voucherUrl: voucherUrl || null,
    extraPhotosCount: Number(extraPhotosCount) || 0,
    printedPhotosCount: Number(printedPhotosCount) || 0,
    printedPhotos10x15Count: Number(printedPhotos10x15Count) || 0,
    printedPhotos15x20Count: Number(printedPhotos15x20Count) || 0,
    retablosCount: Number(retablosCount) || 0,
    printedSizes: printedSizes || {},
    paperPhotosSummary: paperPhotosSummary || '',
    retablosSummary: retablosSummary || '',
    printedPhotosSummary: printedPhotosSummary || '',
    concept: concept || 'Sesión Fotográfica',
    // El estado NUNCA se acepta del cliente: solo un administrador autenticado
    // puede marcarlo como verificado (y debe pedirlo explícitamente).
    status: isAdminCaller && status === 'verified' ? 'verified' : 'pending',
    createdAt: new Date().toISOString()
  };

  if (!runtimeDB.payments) runtimeDB.payments = [];
  runtimeDB.payments.unshift(newPayment);

  const photogWhatsApp1 = (runtimeDB.settings.photographerWhatsApp || '+573244725167').replace(/\D/g, '');
  const photogWhatsApp2 = (runtimeDB.settings.photographerWhatsApp2 || '+573023696513').replace(/\D/g, '');
  const methodNames = {
    nequi: 'Nequi (3244725167)',
    daviplata: 'DaviPlata (Llave @PLATA3244725167)',
    dale: 'Dale! (Llave @SGG04)'
  };
  const methodName = methodNames[newPayment.method] || newPayment.method;

  let detailItems = '';
  if (newPayment.extraPhotosCount > 0) {
    detailItems += `\n📸 *Fotos Extra:* +${newPayment.extraPhotosCount} foto(s)`;
  }
  if (newPayment.paperPhotosSummary) {
    detailItems += `\n🖼️ *Fotos Impresas (Papel):* ${newPayment.paperPhotosSummary}`;
  } else if (newPayment.printedPhotosCount > 0) {
    detailItems += `\n🖼️ *Fotos Impresas:* +${newPayment.printedPhotosCount} foto(s)`;
  }
  if (newPayment.retablosSummary) {
    detailItems += `\n🪵 *Cuadros en Retablo:* ${newPayment.retablosSummary}`;
  }

  const msgText = encodeURIComponent(
    `💰 *¡Hola Sebastian G! Acabo de registrar mi pago de fotos:*\n` +
    `👤 *Cliente:* ${newPayment.clientName}\n` +
    `📱 *WhatsApp:* ${newPayment.clientWhatsApp}\n` +
    `💵 *Monto Transferido:* $${newPayment.amount.toLocaleString('es-CO')} COP\n` +
    `💳 *Pasarela / Billetera:* ${methodName}\n` +
    `🔢 *Referencia:* ${newPayment.reference || 'Comprobante adjunto'}` +
    detailItems + `\n` +
    `_Comprobante registrado en la plataforma. ¡Por favor verifica mi pago!_`
  );

  sendOneSignalPush({
    title: '💰 ¡Nuevo Pago Registrado!',
    message: `${newPayment.clientName} registró pago de $${newPayment.amount.toLocaleString('es-CO')} COP (${methodName})`,
    url: 'https://sebastiang.app/?mode=admin',
    data: { type: 'payment', paymentId: newPayment.id }
  }).catch(err => console.error('Error OneSignal Push pago:', err));

  res.status(201).json({
    success: true,
    payment: newPayment,
    directWhatsAppUrl: `https://wa.me/${photogWhatsApp1}?text=${msgText}`,
    secondaryWhatsAppUrl: `https://wa.me/${photogWhatsApp2}?text=${msgText}`
  });
});

app.patch('/api/admin/payments/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const payment = (runtimeDB.payments || []).find(p => p.id === id);
  if (!payment) return res.status(404).json({ error: 'Pago no encontrado.' });
  payment.status = status;
  res.json({ success: true, payment });
});

app.get('/api/admin/sessions', (req, res) => {
  const now = Date.now();
  const sessions = (runtimeDB.sessions || []).filter(s => s && s.id !== 'sess-demo' && s.token !== 'demo-cliente-2026');
  const enriched = sessions.map(s => {
    const expiresTime = new Date(s.expiresAt).getTime();
    const isExpired = now > expiresTime;
    return {
      ...s,
      isExpired,
      selectedCount: s.photos ? s.photos.filter(p => p.selected).length : 0,
      totalPhotos: s.photos ? s.photos.length : 0
    };
  });
  res.json(enriched);
});

app.delete('/api/admin/sessions/:id', (req, res) => {
  const { id } = req.params;
  const rawId = (id || '').trim();
  const cleanId = rawId.replace(/^sess-/, '');
  runtimeDB.sessions = (runtimeDB.sessions || []).filter(s => {
    if (!s) return false;
    const match =
      s.id === rawId ||
      s.token === rawId ||
      s.id === cleanId ||
      s.token === cleanId ||
      s.id === `sess-${cleanId}` ||
      s.token === `sess-${cleanId}`;
    return !match;
  });
  res.json({ success: true });
});

app.post('/api/admin/sessions', (req, res) => {
  const {
    clientName, clientWhatsApp, packageTitle, maxPhotosAllowed, photos,
    totalPrice, packagePrice, sessionBasePrice, bookingId, location
  } = req.body;

  if (!clientName || !clientWhatsApp || !photos || photos.length === 0) {
    return res.status(400).json({ error: 'Faltan datos del cliente o fotos para la sesión.' });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const cleanName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15);
  const token = `${cleanName}-${Math.random().toString(36).substring(2, 8)}`;
  const finalPrice = Number(totalPrice || packagePrice || sessionBasePrice || 0);

  const newSession = {
    id: `sess-${Date.now()}`,
    token,
    clientName: clientName.trim(),
    clientWhatsApp: clientWhatsApp.trim(),
    packageTitle: packageTitle || 'Sesión Fotográfica',
    totalPrice: finalPrice,
    packagePrice: finalPrice,
    sessionBasePrice: finalPrice,
    bookingId: bookingId || null,
    location: location || '',
    maxPhotosAllowed: Number(maxPhotosAllowed) || photos.length,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'pending',
    submittedAt: null,
    photos: photos.map((p, idx) => ({
      id: `photo-${Date.now()}-${idx + 1}`,
      title: p.title || `Foto #${idx + 1}`,
      url: p.url,
      selected: false,
      clientComment: ''
    }))
  };

  runtimeDB.sessions.unshift(newSession);

  if (SUPABASE_REST_KEY) {
    try {
      fetch(`${SUPABASE_REST_URL}/rest/v1/catalog`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_REST_KEY,
          'Authorization': `Bearer ${SUPABASE_REST_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: `sess-${token}`,
          title: newSession.clientName,
          category: 'session_data',
          location: newSession.clientWhatsApp,
          url: JSON.stringify(newSession)
        })
      }).catch(e => console.warn('Sync session to Supabase warning:', e));
    } catch(e) {}
  }

  res.status(201).json({
    success: true,
    session: newSession,
    link: `/galeria/${token}`
  });
});

app.post('/api/admin/sessions/:id/reopen', (req, res) => {
  const { id } = req.params;
  const { additionalDays = 3, allowReSelection = true } = req.body;
  const session = (runtimeDB.sessions || []).find(s => s.id === id);
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });

  const newExpires = new Date(Date.now() + additionalDays * 24 * 60 * 60 * 1000);
  session.expiresAt = newExpires.toISOString();
  if (allowReSelection) {
    session.status = 'pending';
    session.submittedAt = null;
  }
  res.json({ success: true, session });
});

app.post('/api/admin/sessions/:id/deliver', (req, res) => {
  const { id } = req.params;
  const { finalDeliveryUrl, deliveryService = 'wetransfer', deliveryNotes = '', finalPhotos = [] } = req.body;
  const session = (runtimeDB.sessions || []).find(s => s.id === id || s.token === id);
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });

  session.status = 'delivered';
  session.finalDeliveryUrl = (finalDeliveryUrl || '').trim();
  session.deliveryService = deliveryService;
  session.deliveryNotes = (deliveryNotes || '').trim();
  session.deliveredAt = new Date().toISOString();
  if (Array.isArray(finalPhotos) && finalPhotos.length > 0) {
    session.finalPhotos = finalPhotos;
  }
  res.json({ success: true, session });
});

app.post('/api/admin/settings', (req, res) => {
  const { settings, packages } = req.body;
  if (settings) {
    // Nunca permitir que se sobreescriba el hash del PIN por este endpoint
    const { adminPin, adminPinHash, ...safeSettings } = settings;
    runtimeDB.settings = { ...runtimeDB.settings, ...safeSettings };
  }
  if (packages && Array.isArray(packages)) {
    runtimeDB.packages = packages;
  }
  res.json({ success: true, settings: runtimeDB.settings, packages: runtimeDB.packages });
});

// ==============================================================================
// GESTIÓN DE CATÁLOGO
// ==============================================================================
app.post('/api/admin/catalog', (req, res) => {
  const { id, title, category, url, location } = req.body;
  if (!title || !url) {
    return res.status(400).json({ error: 'Faltan título o imagen de la foto.' });
  }
  const newItem = {
    id: id || `cat-${Date.now()}`,
    title: title.trim(),
    category: (category || 'Retratos').trim(),
    url: url.trim(),
    location: (location || 'San Antero').trim(),
    createdAt: new Date().toISOString()
  };
  if (!runtimeDB.catalog) runtimeDB.catalog = [];
  runtimeDB.catalog = runtimeDB.catalog.filter(c => c.id !== newItem.id && c.url !== newItem.url);
  runtimeDB.catalog.unshift(newItem);
  res.status(201).json({ success: true, item: newItem });
});

app.delete('/api/admin/catalog/:id', (req, res) => {
  const { id } = req.params;
  const bodyTitle = req.body && req.body.title ? req.body.title.trim().toLowerCase() : null;
  const target = (runtimeDB.catalog || []).find(c => c.id === id);
  const targetTitle = bodyTitle || (target?.title ? target.title.trim().toLowerCase() : null);
  runtimeDB.catalog = (runtimeDB.catalog || []).filter(c => {
    if (c.id === id) return false;
    if (targetTitle && c.title && c.title.trim().toLowerCase() === targetTitle) return false;
    return true;
  });
  res.json({ success: true, id });
});

app.post('/api/admin/catalog/delete-samples', (req, res) => {
  runtimeDB.catalog = (runtimeDB.catalog || []).filter(c => {
    const isSample = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-8'].includes(c.id) ||
      (c.url && c.url.includes('unsplash.com'));
    return !isSample;
  });
  res.json({ success: true, catalog: runtimeDB.catalog });
});

// ==============================================================================
// SEGURIDAD: CAMBIO DE PIN (solo con hash)
// ==============================================================================
app.post('/api/admin/pin/change', (req, res) => {
  // El PIN se valida contra el hash del ENTORNO (ADMIN_PIN_SCRYPT o ADMIN_PIN_HASH).
  // Antes este endpoint escribía el hash solo en memoria: parecía funcionar y se
  // revertía en el siguiente arranque de la función serverless. Ahora se explica
  // cómo cambiarlo de verdad en lugar de simular un cambio que no persiste.
  const { currentPin } = req.body || {};
  const expectedHash = process.env.ADMIN_PIN_HASH || runtimeDB.settings.adminPinHash || '';

  if (expectedHash && !secureCompare(hashSHA256(currentPin), expectedHash)) {
    return res.status(401).json({ error: 'El PIN actual no coincide.' });
  }

  return res.status(409).json({
    error: 'El PIN se define en el servidor: un cambio desde aquí no sobreviviría al siguiente despliegue.',
    howTo: [
      'Genera el hash con: node scripts/hash-admin-pin.mjs "TU_PIN_NUEVO"',
      'Actualiza la variable ADMIN_PIN_SCRYPT en Vercel (y en tu .env local).',
      'Vuelve a desplegar.'
    ]
  });
});

// ==============================================================================
// RECUPERACIÓN DE PIN POR TELÉFONO: ELIMINADA
// ==============================================================================
// Antes este endpoint permitía fijar un PIN nuevo (o leer el vigente) con solo
// conocer los últimos 7 dígitos de un WhatsApp público: era una toma de control
// del panel sin credenciales. La recuperación ahora es una operación de
// administración del servidor: se cambia ADMIN_PIN_SCRYPT / ADMIN_PIN_HASH en
// las variables de entorno y se vuelve a desplegar.
// ==============================================================================

// ==============================================================================
// RESEÑAS
// ==============================================================================
app.get('/api/reviews', async (req, res) => {
  let reviews = runtimeDB.reviews || [];

  if (SUPABASE_REST_KEY) {
    try {
      const supaRes = await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog?category=eq.review_data&select=*&order=created_at.desc`, {
        headers: {
          'apikey': SUPABASE_REST_KEY,
          'Authorization': `Bearer ${SUPABASE_REST_KEY}`
        }
      });
      if (supaRes.ok) {
        const rows = await supaRes.json();
        if (Array.isArray(rows)) {
          const cloudReviews = rows.map(r => {
            try { return JSON.parse(r.url); } catch (e) { return null; }
          }).filter(Boolean);
          const map = new Map();
          [...reviews, ...cloudReviews].forEach(rev => {
            if (rev && rev.id) map.set(rev.id, rev);
          });
          reviews = Array.from(map.values());
          runtimeDB.reviews = reviews;
        }
      }
    } catch (err) {
      console.warn('Error obteniendo reseñas desde Supabase:', err);
    }
  }

  reviews = reviews.filter(r => r && r.id && !r.id.startsWith('rev-jennifer-vasquez') && !r.id.startsWith('rev-ayda-luz') && !r.id.startsWith('rev-shamara')).map(r => {
    const clean = { ...r };
    delete clean.sessionTitle;
    delete clean.sessionType;
    delete clean.packageTitle;
    return clean;
  });
  res.json(reviews);
});

app.post('/api/reviews', async (req, res) => {
  const { clientName, rating, recommend, comment } = req.body || {};
  if (!clientName || !comment) {
    return res.status(400).json({ error: 'Faltan nombre del cliente o comentario.' });
  }
  const newReview = {
    id: `rev-${Date.now()}`,
    clientName: String(clientName).trim(),
    rating: Number(rating) || 5,
    recommend: recommend !== false,
    comment: String(comment).trim(),
    date: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    verified: true,
    createdAt: new Date().toISOString()
  };
  if (!runtimeDB.reviews) runtimeDB.reviews = [];
  runtimeDB.reviews.unshift(newReview);

  if (SUPABASE_REST_KEY) {
    try {
      await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_REST_KEY,
          'Authorization': `Bearer ${SUPABASE_REST_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: `rev-${newReview.id}`,
          title: newReview.clientName,
          category: 'review_data',
          location: `${newReview.rating} estrellas`,
          url: JSON.stringify(newReview)
        })
      });
    } catch (err) {
      console.warn('Error al guardar reseña en Supabase:', err);
    }
  }

  sendOneSignalPush({
    title: `⭐ ¡Nueva Calificación de ${newReview.clientName}!`,
    message: `${'⭐'.repeat(newReview.rating)} (${newReview.rating}/5) - "${newReview.comment.slice(0, 80)}"`,
    url: 'https://sebastiang.app/?mode=admin',
    data: { type: 'review', reviewId: newReview.id }
  }).catch(err => console.error('Error OneSignal Push reseña:', err));

  res.status(201).json({ success: true, review: newReview });
});

app.post('/api/gallery/:token/review', async (req, res) => {
  const { clientName, rating, recommend, comment } = req.body || {};
  const newReview = {
    id: `rev-${Date.now()}`,
    clientName: String(clientName || 'Cliente').trim(),
    rating: Number(rating) || 5,
    recommend: recommend !== false,
    comment: String(comment || '').trim(),
    date: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    verified: true,
    createdAt: new Date().toISOString()
  };
  if (!runtimeDB.reviews) runtimeDB.reviews = [];
  runtimeDB.reviews.unshift(newReview);

  if (SUPABASE_REST_KEY) {
    try {
      await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_REST_KEY,
          'Authorization': `Bearer ${SUPABASE_REST_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: `rev-${newReview.id}`,
          title: newReview.clientName,
          category: 'review_data',
          location: `${newReview.rating} estrellas`,
          url: JSON.stringify(newReview)
        })
      });
    } catch (err) {}
  }

  sendOneSignalPush({
    title: `⭐ ¡Nueva Reseña de ${newReview.clientName}!`,
    message: `${'⭐'.repeat(newReview.rating)} (${newReview.rating}/5) - "${newReview.comment.slice(0, 80)}"`,
    url: 'https://sebastiang.app/?mode=admin',
    data: { type: 'review', reviewId: newReview.id }
  }).catch(err => console.error('Error Push galería reseña:', err));

  res.json({ success: true, review: newReview });
});

app.delete('/api/admin/reviews/:id', async (req, res) => {
  const { id } = req.params;
  runtimeDB.reviews = (runtimeDB.reviews || []).filter(r => r.id !== id);

  if (SUPABASE_REST_KEY) {
    try {
      await fetch(`${SUPABASE_REST_URL}/rest/v1/catalog?id=eq.rev-${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_REST_KEY,
          'Authorization': `Bearer ${SUPABASE_REST_KEY}`
        }
      });
    } catch (err) {}
  }
  res.json({ success: true, id });
});

// ==============================================================================
// WEBHOOK BOT WHATSAPP
// ==============================================================================
app.all('/api/bot-webhook', async (req, res) => {
  try {
    const rawMsg = (req.body?.query?.message || req.body?.message || req.query?.message || '').trim();
    const sender = (req.body?.query?.sender || req.body?.sender || req.query?.sender || 'Cliente').trim();
    const cleanMsg = rawMsg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const packages = Array.isArray(runtimeDB.packages) && runtimeDB.packages.length > 0 ? runtimeDB.packages : [
      { name: '4 Fotos Digitales', price: 45000, features: ['+ 2 Fotos GRATIS (Total: 6)'] },
      { name: '6 Fotos Digitales', price: 65000, features: ['+ 2 Fotos GRATIS (Total: 8)'] },
      { name: '8 Fotos Digitales', price: 75000, features: ['Nuestra más pedida (Total: 10)'] },
      { name: '10 Fotos Digitales', price: 85000, features: ['+ 2 Fotos GRATIS'] }
    ];

    let replyText = '';

    if (cleanMsg === '1' || cleanMsg.includes('paquete') || cleanMsg.includes('precio')) {
      let pkgList = packages.map(p => `🔹 *${p.name}:* $${Number(p.price).toLocaleString('es-CO')} COP`).join('\n');
      replyText = `📸 *NUESTROS PAQUETES OFICIALES DE FOTOGRAFÍA:*\n${pkgList}\n✨ *Todas las opciones incluyen:* Retoque profesional.\n📅 *¿Deseas apartar tu cupo?*\n👉 https://sebastiang.app/#reservar`;
    } else if (cleanMsg === '2' || cleanMsg.includes('reservar') || cleanMsg.includes('agendar')) {
      replyText = `🗓️ *¡EXCELENTE DECISIÓN!*\n🌐 Reserva en la web: https://sebastiang.app/#reservar\n💬 O envía: Nombre, Fecha, Paquete, Locación.`;
    } else if (cleanMsg === '3' || cleanMsg.includes('foto') || cleanMsg.includes('portafolio')) {
      replyText = `🎨 *CONOCE NUESTRO TRABAJO:*\n👉 https://sebastiang.app\nInstagram: @sebastiang_fotos`;
    } else if (cleanMsg === '4' || cleanMsg.includes('nequi') || cleanMsg.includes('pago')) {
      replyText = `💳 *CUENTAS OFICIALES:*\n🟣 Nequi: 324 472 5167\n🔴 DaviPlata: @PLATA3244725167\n🟡 Dale!: @SGG04`;
    } else if (cleanMsg === '5' || cleanMsg.includes('humano') || cleanMsg.includes('sebastian')) {
      sendOneSignalPush({
        title: '💬 Cliente solicita hablar contigo',
        message: `${sender} quiere hablar con Sebastian G en WhatsApp`,
        url: 'https://sebastiang.app/?mode=admin'
      });
      replyText = `👨💼 *¡Entendido! Ya le avisé a Sebastian.* En unos minutos estará contigo.`;
    } else if (cleanMsg.includes('comprobante') || cleanMsg.includes('transfiri')) {
      sendOneSignalPush({
        title: '💰 Comprobante enviado por WhatsApp',
        message: `${sender} indica que envió un comprobante`,
        url: 'https://sebastiang.app/?mode=admin'
      });
      replyText = `✅ *¡Muchas gracias por tu comprobante!* Sebastian lo revisará en breve.`;
    } else {
      replyText = `¡Hola! 👋 Bienvenido a *Sebastian G • Fotografía* 📸✨\n1️⃣ Paquetes y precios\n2️⃣ Reservar fecha\n3️⃣ Ver portafolio\n4️⃣ Cuentas de pago\n5️⃣ Hablar con Sebastian\n👉 *Escribe el número de la opción*`;
    }

    return res.json({
      replies: [{ message: replyText }],
      reply: replyText,
      success: true
    });
  } catch (err) {
    console.error('Error en webhook de bot WhatsApp:', err);
    return res.status(500).json({ error: 'Error procesando respuesta del bot' });
  }
});

export default app;
