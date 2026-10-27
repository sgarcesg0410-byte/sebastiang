import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import {
  createAdminToken,
  createBioRefreshToken,
  verifyBioRefreshToken,
  requireAdminAuth,
  verifyAdminPin,
  isWeakConfiguredPin,
  createReceiptToken,
  readAdminToken,
  verifyAdminToken,
  KNOWN_WEAK_PIN_HASH,
  setPasswordVersionGetter,
  generateGalleryToken,
  isValidGalleryTokenFormat,
  maskEmail,
  maskPhone,
  getTrustedClientIp,
  toMinimalApkFeed,
  createApkDeviceToken,
  verifyApkDeviceToken,
  recordFinancialAuditLog,
  AUDIT_LOG_RETENTION_DAYS,
  pruneExpiredAuditLogs,
  sanitizeBackupSnapshot,
  encryptBackupPayload,
  decryptBackupPayload,
  recordOperationalEvent,
  getOperationalMonitoringReport,
  secureCompare
} from './security.js';
import {
  validateImagePayload,
  validateSessionPhotosBatch,
  DEFAULT_MAX_IMAGE_BYTES,
  DEFAULT_MAX_VOUCHER_BYTES
} from './uploadValidator.js';
import { registerPublicRoutes } from './publicRoutes.js';
import { resolveBookingPrice } from './pricingGuard.js';
import {
  sendNewBookingEmails,
  sendBookingConfirmedEmail,
  sendSessionCompletedEmail,
  sendPaymentReceiptEmail,
  sendPhotoDeliveryEmail,
  sendTwoFactorCodeEmail,
  sendPasswordChangedAlertEmail
} from './emailService.js';
import {
  handlePasswordResetRequest,
  handlePasswordResetConfirm,
  getActivePasswordVersionFromStore,
  updateAdminPasswordInStore,
  getAdminEmail
} from './passwordReset.js';
import {
  generatePaymentReference,
  generateWompiSignature,
  verifyWompiChecksum,
  validateCheckoutAmount
} from './payments/gateway.js';
import {
  isMongoConfigured,
  upsertMongoDoc,
  findMongoDocs,
  findMongoDoc,
  deleteMongoDoc
} from './db/mongo.js';

const ALLOWED_ORIGINS = [
  'https://sebastiang.app',
  'https://www.sebastiang.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

const app = express();
app.set('trust proxy', 1);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      /^https:\/\/[a-z0-9-]+(\.vercel\.app)$/.test(origin) ||
      origin.startsWith('capacitor://') ||
      origin.startsWith('http://localhost')
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token', 'x-apk-device-token', 'x-apk-key']
}));
app.use(express.json({ limit: '50mb' }));

// ==============================================================================
// CONFIGURACIÓN Y CLIENTE ONESIGNAL PUSH 24/7
// ==============================================================================
// Las claves se leen EXCLUSIVAMENTE desde variables de entorno.
// Si no están configuradas, las notificaciones push se deshabilitan sin fallar.
// ==============================================================================
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || 'bc62cb00-9782-4a8e-a344-e8cf031a211a';
let rawOneSignalKey = process.env.ONESIGNAL_REST_API_KEY || '';
// Detectar si la clave fue provista en Base64 y decodificarla
if (rawOneSignalKey && !rawOneSignalKey.startsWith('os_v2_')) {
  try {
    const decoded = Buffer.from(rawOneSignalKey, 'base64').toString('utf8');
    if (decoded.startsWith('os_v2_') || decoded.length > 20) {
      rawOneSignalKey = decoded;
    }
  } catch (e) {}
}
const ONESIGNAL_REST_API_KEY = rawOneSignalKey;

if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.warn(
    '⚠️ [OneSignal] ONESIGNAL_APP_ID o ONESIGNAL_REST_API_KEY no configuradas. ' +
    'Las notificaciones push estarán deshabilitadas.'
  );
}

async function sendOneSignalPush({ title, message, url = 'https://sebastiang.app/?mode=admin', data = {} }) {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return { id: 'test-push-suppressed', simulated: true };
  }
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
// BASE DE DATOS OFICIAL: MongoDB Atlas es la única fuente de verdad persistente.
// ==============================================================================
if (!isMongoConfigured() && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  console.warn(
    '⚠️ [Database] MONGODB_URI no está configurado. ' +
    'El servidor operará únicamente con caché en memoria volátil.'
  );
}

// Configurar validador de versión de contraseña en tiempo real para sesiones admin
setPasswordVersionGetter(() => getActivePasswordVersionFromStore({
  runtimeDB
}));

function normalizeBookingDoc(b) {
  if (!b || !b.id) return null;
  const name = String(b.clientName || b.client_name || '').trim();
  const phone = String(b.clientWhatsApp || b.client_whatsapp || '').trim();
  const email = String(b.clientEmail || b.client_email || '').trim();
  const pkgId = String(b.packageId || b.package_id || 'pkg-4fotos').trim();
  const pkgName = String(b.packageName || b.package_name || 'Sesión Fotográfica').trim();
  const price = Number(b.totalPrice ?? b.total_price ?? 0);
  const locType = String(b.locationType || b.location_type || 'san_antero').trim();
  const specLoc = String(b.specificLocation || b.specific_location || '').trim();
  const dt = String(b.dateTime || b.date_time || '').trim();
  const desc = String(b.description || b.notes || '').trim();
  const st = String(b.status || 'pending').trim();
  const cr = b.createdAt || b.created_at || new Date().toISOString();

  return {
    ...b,
    id: b.id,
    clientName: name,
    client_name: name,
    clientWhatsApp: phone,
    client_whatsapp: phone,
    clientEmail: email,
    client_email: email,
    packageId: pkgId,
    package_id: pkgId,
    packageName: pkgName,
    package_name: pkgName,
    totalPrice: price,
    total_price: price,
    locationType: locType,
    location_type: locType,
    specificLocation: specLoc,
    specific_location: specLoc,
    dateTime: dt,
    date_time: dt,
    description: desc,
    status: st,
    createdAt: cr,
    created_at: cr,
    isReal: true
  };
}

function mergeBookingObjectsServer(existing, incoming) {
  if (!existing) return normalizeBookingDoc(incoming);
  if (!incoming) return normalizeBookingDoc(existing);
  const merged = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null && v !== '') {
      if ((k === 'totalPrice' || k === 'total_price') && Number(v) === 0 && Number(existing.totalPrice || existing.total_price || 0) > 0) {
        continue;
      }
      merged[k] = v;
    }
  }
  return normalizeBookingDoc(merged);
}

async function persistBookingToMongo(b) {
  if (!b || !b.id) return;
  const supaId = b.id.startsWith('book-') ? b.id : `book-${b.id}`;
  const normalized = normalizeBookingDoc(b);

  if (isMongoConfigured() && normalized) {
    try {
      await upsertMongoDoc('bookings', { id: b.id }, { ...normalized, id: b.id, supaId });
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error guardando reserva:', eMongo?.message || eMongo);
    }
  }
}

async function persistPaymentToMongo(p) {
  if (!p || !p.id) return;
  const supaId = p.id.startsWith('pay-') ? p.id : `pay-${p.id}`;

  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('payments', { id: p.id }, { ...p, id: p.id, supaId });
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error guardando pago:', eMongo?.message || eMongo);
    }
  }
}

async function findPaymentByReference(ref, txId) {
  if (!ref && !txId) return null;
  // 1. Memoria
  let found = (runtimeDB.payments || []).find(p => p && ((ref && p.reference === ref) || (txId && p.transactionId === txId)));
  if (found) return found;

  // 2. MongoDB Atlas (única fuente de verdad persistente)
  if (isMongoConfigured()) {
    try {
      const orConditions = [];
      if (ref) orConditions.push({ reference: ref });
      if (txId) orConditions.push({ transactionId: txId });
      const query = orConditions.length > 1 ? { $or: orConditions } : orConditions[0];
      const doc = await findMongoDoc('payments', query);
      if (doc) return doc;
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error buscando pago por referencia:', eMongo?.message || eMongo);
    }
  }

  return null;
}

async function findBookingById(bookingId) {
  if (!bookingId) return null;
  const cleanId = String(bookingId);
  const supaId = cleanId.startsWith('book-') ? cleanId : `book-${cleanId}`;

  // 1. Memoria
  const found = (runtimeDB.bookings || []).find(b => b && (b.id === cleanId || b.id === supaId));
  if (found) return found;

  // 2. MongoDB Atlas (única fuente de verdad persistente)
  if (isMongoConfigured()) {
    try {
      const doc = await findMongoDoc('bookings', { $or: [{ id: cleanId }, { id: supaId }, { supaId }] });
      if (doc) return doc;
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error buscando reserva por ID:', eMongo?.message || eMongo);
    }
  }

  return null;
}

// ==============================================================================
// RATE LIMITER EN MEMORIA (Anti-Brute-Force)
// ==============================================================================
const loginAttempts = new Map(); // IP -> { count, windowStart, lockedUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOGIN_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutos

function getClientIp(req) {
  return getTrustedClientIp(req);
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

// Rate Limiter para Checkout de Pagos (máximo 15 checkouts por 10 min por IP)
const checkoutAttempts = new Map(); // IP -> { count, windowStart }
const CHECKOUT_MAX_ATTEMPTS = 15;
const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;

function checkCheckoutRateLimit(ip) {
  const now = Date.now();
  const record = checkoutAttempts.get(ip);
  if (!record || (now - record.windowStart > CHECKOUT_WINDOW_MS)) {
    checkoutAttempts.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (record.count >= CHECKOUT_MAX_ATTEMPTS) {
    return false;
  }
  record.count += 1;
  return true;
}

// Rate limit por ámbito (scope) para endpoints públicos y sensibles
const publicWriteAttempts = new Map(); // `${scope}:${ip}` -> { count, windowStart }
const PUBLIC_WRITE_WINDOW_MS = 10 * 60 * 1000;

export function checkPublicWriteRateLimit(ip, maxAttempts, scope = 'default') {
  const now = Date.now();
  const key = `${scope}:${ip || 'unknown'}`;
  const record = publicWriteAttempts.get(key);
  if (!record || (now - record.windowStart > PUBLIC_WRITE_WINDOW_MS)) {
    publicWriteAttempts.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (record.count >= maxAttempts) {
    return false;
  }
  record.count += 1;
  return true;
}

export function clearApiRateLimiters() {
  loginAttempts.clear();
  checkoutAttempts.clear();
  publicWriteAttempts.clear();
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
  for (const [ip, record] of checkoutAttempts.entries()) {
    if (record && now - record.windowStart > CHECKOUT_WINDOW_MS * 2) {
      checkoutAttempts.delete(ip);
    }
  }
  for (const [ip, record] of publicWriteAttempts.entries()) {
    if (record && now - record.windowStart > PUBLIC_WRITE_WINDOW_MS * 2) {
      publicWriteAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000);
// En serverless un temporizador activo mantiene la instancia viva. Con unref() la
// limpieza sigue funcionando mientras la instancia atiende peticiones, pero no
// impide que el proceso termine (era la causa del cuelgue al cargar el modulo).
if (typeof limpiezaPeriodica.unref === 'function') limpiezaPeriodica.unref();

// ==============================================================================
// SESIONES DE ADMINISTRADOR
// ==============================================================================
// La emisión y verificación de tokens vive en ./security.js (HMAC-SHA256 con
// ADMIN_AUTH_SECRET obligatorio y fallo cerrado). Aquí existía un emisor duplicado
// con un secreto por defecto público ('fallback-dev-secret-change-me'): se eliminó
// para que nadie pueda volver a firmar sesiones con un secreto conocido.
// ==============================================================================

// ==============================================================================
// BASE DE DATOS EN MEMORIA (Caché de baja latencia sincronizado con MongoDB Atlas)
// ==============================================================================
// NOTA: MongoDB Atlas es la única fuente canónica de verdad persistente.
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
  getRuntimeDB: () => runtimeDB
});

// ==============================================================================
// ENDPOINTS PÚBLICOS
// ==============================================================================

app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    service: 'sebastiang-api',
    database: isMongoConfigured() ? 'mongodb-atlas' : 'memory',
    mongoConfigured: isMongoConfigured(),
    smtpConfigured: Boolean(process.env.ZOHO_SMTP_PASS || process.env.SMTP_PASS),
    pushConfigured: Boolean(ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/send-push', requireAdminAuth, async (req, res) => {
  const { title, message, url, data } = req.body || {};
  if (!title || !message) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (title, message)' });
  }
  const result = await sendOneSignalPush({ title, message, url, data });
  res.json({ success: true, result });
});

app.get('/api/settings', async (req, res) => {
  if (isMongoConfigured() && (!runtimeDB.settings || !runtimeDB.settings._loadedFromMongo)) {
    try {
      const mongoSettings = await findMongoDoc('settings', { id: 'app_settings' });
      if (mongoSettings) {
        const { _id, id, ...safe } = mongoSettings;
        runtimeDB.settings = { ...runtimeDB.settings, ...safe, _loadedFromMongo: true };
      }
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error cargando settings:', eMongo?.message || eMongo);
    }
  }
  const { adminPin, adminPinHash, _loadedFromMongo, ...publicSettings } = runtimeDB.settings || {};
  res.json(publicSettings);
});

export function getCatalogItemTimestamp(item) {
  if (!item) return 0;
  if (item.id === 'cat-verano-salsero') return 1789878000000;
  const match = String(item.id || '').match(/^cat-(\d{11,14})/);
  if (match) {
    const ts = Number(match[1]);
    if (!isNaN(ts) && ts > 1000000000000) return ts;
  }
  if (item.createdAt) {
    const t = new Date(item.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (item.created_at) {
    const t = new Date(item.created_at).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (item.updatedAt) {
    const t = new Date(item.updatedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

export function sortCatalogDescending(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => getCatalogItemTimestamp(b) - getCatalogItemTimestamp(a));
}

app.get('/api/catalog', async (req, res) => {
  const filterPhotos = (list) => (list || []).filter(item =>
    item &&
    item.category !== 'session_data' &&
    item.category !== 'vip_client' &&
    !item.category?.endsWith('_data') &&
    !item.id?.startsWith('system_') &&
    !item.id?.startsWith('book-') &&
    !item.id?.startsWith('pay-') &&
    !item.id?.startsWith('rev-') &&
    !item.id?.startsWith('sess-') &&
    !item.id?.startsWith('vip-')
  );

  let cleanCatalog = filterPhotos(runtimeDB.catalog);

  // MongoDB Atlas es la fuente canónica: recargar SIEMPRE para que los cambios
  // (fotos nuevas o reordenamientos) se reflejen sin esperar un cold start.
  if (isMongoConfigured()) {
    try {
      const mongoCatalog = await findMongoDocs('catalog', {}, { createdAt: -1 });
      if (mongoCatalog && mongoCatalog.length > 0) {
        runtimeDB.catalog = mongoCatalog.map(({ _id, ...item }) => item);
        runtimeDB._catalogLoadedFromMongo = true;
        cleanCatalog = filterPhotos(runtimeDB.catalog);
      }
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error cargando catálogo:', eMongo?.message || eMongo);
    }
  }

  // Orden cronológico estricto: Fotos más recientes arriba / de primero
  cleanCatalog = sortCatalogDescending(cleanCatalog);
  res.json(cleanCatalog);
});

app.get('/api/packages', async (req, res) => {
  if (isMongoConfigured() && (!runtimeDB.packages || runtimeDB.packages.length === 0 || !runtimeDB._packagesLoadedFromMongo)) {
    try {
      const mongoPackages = await findMongoDocs('packages', {});
      if (mongoPackages && mongoPackages.length > 0) {
        runtimeDB.packages = mongoPackages.map(({ _id, ...pkg }) => pkg);
        runtimeDB._packagesLoadedFromMongo = true;
      }
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error cargando paquetes:', eMongo?.message || eMongo);
    }
  }
  res.json(runtimeDB.packages || []);
});


app.get('/api/admin/wallets', requireAdminAuth, async (req, res) => {
  if (isMongoConfigured() && (!runtimeDB.walletBalances || !runtimeDB._walletsLoadedFromMongo)) {
    try {
      const doc = await findMongoDoc('settings', { id: 'wallet_balances' });
      if (doc) {
        const { _id, id, ...safe } = doc;
        runtimeDB.walletBalances = { ...runtimeDB.walletBalances, ...safe };
        runtimeDB._walletsLoadedFromMongo = true;
      }
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error cargando wallets:', eMongo?.message || eMongo);
    }
  }
  res.json(runtimeDB.walletBalances || { nequi: 0, daviplata: 0, dale: 0 });
});

app.post('/api/admin/wallets', requireAdminAuth, async (req, res) => {
  const balances = req.body;
  if (balances && typeof balances === 'object') {
    runtimeDB.walletBalances = { ...runtimeDB.walletBalances, ...balances };
    if (isMongoConfigured()) {
      try {
        await upsertMongoDoc('settings', { id: 'wallet_balances' }, { id: 'wallet_balances', ...runtimeDB.walletBalances });
      } catch (eMongo) {
        console.warn('⚠️ [MongoDB] Error guardando wallets:', eMongo?.message || eMongo);
      }
    }
  }
  res.json({ success: true, walletBalances: runtimeDB.walletBalances });
});

app.post('/api/packages', requireAdminAuth, async (req, res) => {
  const { packages } = req.body;
  if (Array.isArray(packages)) {
    runtimeDB.packages = packages;
    if (isMongoConfigured()) {
      try {
        for (const pkg of packages) {
          if (pkg && pkg.id) {
            await upsertMongoDoc('packages', { id: pkg.id }, pkg);
          }
        }
      } catch (eMongo) {
        console.warn('⚠️ [MongoDB] Error guardando paquetes:', eMongo?.message || eMongo);
      }
    }
  }
  res.json({ success: true, packages: runtimeDB.packages });
});

app.post('/api/settings', requireAdminAuth, async (req, res) => {
  const newSettings = req.body;
  if (newSettings && typeof newSettings === 'object') {
    // Nunca permitir que se sobreescriba el hash del PIN por este endpoint
    const { adminPin, adminPinHash, ...safeSettings } = newSettings;
    runtimeDB.settings = { ...runtimeDB.settings, ...safeSettings };
    if (isMongoConfigured()) {
      try {
        await upsertMongoDoc('settings', { id: 'app_settings' }, { id: 'app_settings', ...safeSettings });
      } catch (eMongo) {
        console.warn('⚠️ [MongoDB] Error guardando settings:', eMongo?.message || eMongo);
      }
    }
  }
  res.json({ success: true, settings: runtimeDB.settings });
});

// Parser de fecha/hora para validar solapamiento de cupos en el servidor (duración estimada: 120 min)
const SERVER_SESSION_DURATION_MIN = 120;
const INACTIVE_BOOKING_STATUSES = new Set(['cancelled', 'canceled', 'cancelada', 'anulada', 'rejected', 'completed', 'delivered']);

function parseServerBookingDateTime(str) {
  if (!str) return null;
  const s = String(str).trim();
  let dateKey = null;
  const dm = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dm) {
    dateKey = `${dm[3]}-${String(dm[2]).padStart(2, '0')}-${String(dm[1]).padStart(2, '0')}`;
  } else {
    const ym = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ym) dateKey = `${ym[1]}-${String(ym[2]).padStart(2, '0')}-${String(ym[3]).padStart(2, '0')}`;
  }
  if (!dateKey) return null;

  const tm = s.match(/(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/i);
  if (!tm) return null;
  let h = parseInt(tm[1], 10);
  const m = parseInt(tm[2], 10);
  const ap = (tm[3] || '').toLowerCase().replace(/[.\s]/g, '');
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  const startMin = h * 60 + m;
  return { dateKey, startMin, endMin: startMin + SERVER_SESSION_DURATION_MIN };
}

// Obtiene la lista vigente de dispositivos APK revocados desde MongoDB Atlas + memoria
async function getRevokedApkDeviceIdsFromStore() {
  const inMem = Array.isArray(runtimeDB.settings?.revokedApkDeviceIds)
    ? runtimeDB.settings.revokedApkDeviceIds
    : [];
  if (isMongoConfigured()) {
    try {
      const settingsDoc = await findMongoDoc('settings', { id: 'app_settings' });
      if (Array.isArray(settingsDoc?.revokedApkDeviceIds)) {
        const merged = [...new Set([...inMem, ...settingsDoc.revokedApkDeviceIds])];
        runtimeDB.settings = runtimeDB.settings || {};
        runtimeDB.settings.revokedApkDeviceIds = merged;
        return merged;
      }
    } catch (eMongo) {
      recordOperationalEvent('mongoErrors', `Error consultando revokedApkDeviceIds: ${eMongo?.message || eMongo}`, 'warning');
    }
  }
  return inMem;
}

// Endpoint exclusivo de alta eficiencia para la APK nativa Android:
// Acepta token por dispositivo con alcance exclusivo apk_feed:read (rotativo y revocable),
// verificando en CADA petición tanto passwordVersion como revokedApkDeviceIds.
app.get('/api/apk/feed', async (req, res, next) => {
  const rawDeviceHeader = String(req.headers['x-apk-device-token'] || '').trim();
  const bearerToken = String(req.headers.authorization || '').startsWith('Bearer ')
    ? String(req.headers.authorization).slice(7).trim()
    : '';
  const candidateToken = rawDeviceHeader || bearerToken;

  if (candidateToken) {
    // Si es un token de administrador válido, delegar a requireAdminAuth
    if (!rawDeviceHeader && verifyAdminToken(candidateToken)) {
      return requireAdminAuth(req, res, next);
    }

    const [activeVersion, revokedDeviceIds] = await Promise.all([
      getActivePasswordVersionFromStore({ runtimeDB }),
      getRevokedApkDeviceIdsFromStore()
    ]);
    const devicePayload = verifyApkDeviceToken(candidateToken, {
      expectedPasswordVersion: activeVersion,
      revokedDeviceIds
    });
    if (devicePayload) {
      req.apkDevice = devicePayload;
      return next();
    }

    recordOperationalEvent('failedApkAuths', `Intento fallido o token APK revocado desde IP ${getClientIp(req)}`, 'warning');
    await recordFinancialAuditLog({
      action: 'apk_auth_failed',
      actor: 'apk_device',
      entityType: 'apk_device',
      status: 'rejected',
      ip: getClientIp(req)
    }, { runtimeDB, isMongoConfigured, upsertMongoDoc });

    if (rawDeviceHeader) {
      return res.status(401).json({ error: 'Token de dispositivo APK inválido, expirado o revocado.' });
    }
  }

  const configuredSecret = (process.env.APK_FEED_SECRET || '').trim();
  const providedKey = String(req.headers['x-apk-key'] || '').trim();
  if (configuredSecret && providedKey && secureCompare(configuredSecret, providedKey)) {
    return next();
  }
  return requireAdminAuth(req, res, next);
}, async (req, res) => {
  try {
    let bookings = [];
    let payments = [];
    let sessions = [];
    let reviews = [];

    if (isMongoConfigured()) {
      try {
        const [bDocs, pDocs, sDocs, rDocs] = await Promise.all([
          findMongoDocs('bookings', {}, { createdAt: -1 }, 10),
          findMongoDocs('payments', {}, { createdAt: -1 }, 10),
          findMongoDocs('sessions', {}, { createdAt: -1 }, 10),
          findMongoDocs('reviews', {}, { createdAt: -1 }, 10)
        ]);
        if (Array.isArray(bDocs)) bookings = bDocs.map(({ _id, ...b }) => normalizeBookingDoc(b)).filter(Boolean);
        if (Array.isArray(pDocs)) payments = pDocs.map(({ _id, ...p }) => p);
        if (Array.isArray(sDocs)) sessions = sDocs.map(({ _id, ...s }) => s);
        if (Array.isArray(rDocs)) reviews = rDocs.map(({ _id, ...r }) => r);
      } catch (errMongo) {
        console.warn('⚠️ [MongoDB] Error alimentando /api/apk/feed:', errMongo?.message || errMongo);
      }
    }

    if (bookings.length === 0 && Array.isArray(runtimeDB.bookings)) {
      bookings = runtimeDB.bookings.slice(0, 10).map(b => normalizeBookingDoc(b)).filter(Boolean);
    }
    if (payments.length === 0 && Array.isArray(runtimeDB.payments)) {
      payments = runtimeDB.payments.slice(0, 10);
    }
    if (sessions.length === 0 && Array.isArray(runtimeDB.sessions)) {
      sessions = runtimeDB.sessions.slice(0, 10);
    }
    if (reviews.length === 0 && Array.isArray(runtimeDB.reviews)) {
      reviews = runtimeDB.reviews.slice(0, 10);
    }

    // Respuesta reducida por dispositivo: cero teléfonos, cero correos, cero tokens de galería ni URLs privadas
    const minimalFeed = toMinimalApkFeed({ bookings, payments, sessions, reviews });

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...minimalFeed
    });
  } catch (err) {
    console.error('Error en /api/apk/feed:', err);
    return res.status(500).json({ error: 'Error en feed de APK' });
  }
});

app.post('/api/bookings', async (req, res) => {
  const clientIp = getClientIp(req);
  const cleanPhoneKey = String(req.body?.clientWhatsApp || '').replace(/\D/g, '').slice(-8);
  if (
    !checkPublicWriteRateLimit(clientIp, 12, 'bookings') ||
    (cleanPhoneKey && !checkPublicWriteRateLimit(cleanPhoneKey, 6, 'bookings-phone'))
  ) {
    return res.status(429).json({ error: 'Demasiadas solicitudes de reserva desde tu conexión. Intenta nuevamente en unos minutos.' });
  }
  const {
    clientName, clientWhatsApp, clientEmail, packageId,
    locationType, specificLocation, dateTime, description,
    totalPrice, printedPhotosCount, printedPhotos10x15Count,
    printedPhotos15x20Count, retablosCount, printedSizes,
    paperPhotosSummary, retablosSummary, printedPhotosSummary
  } = req.body;

  // Prevención de doble reserva en el servidor (409 Conflict si hay solapamiento en ventana de 120 min)
  const requestedSlot = parseServerBookingDateTime(dateTime);
  if (requestedSlot) {
    let existingBookings = Array.isArray(runtimeDB.bookings) ? [...runtimeDB.bookings] : [];
    if (isMongoConfigured()) {
      try {
        const mongoDocs = await findMongoDocs('bookings', {}, { createdAt: -1 }, 200);
        if (Array.isArray(mongoDocs)) {
          existingBookings = [...existingBookings, ...mongoDocs];
        }
      } catch (eMongo) {}
    }

    const seenBookingIds = new Set();
    for (const existing of existingBookings) {
      if (!existing || !existing.id || seenBookingIds.has(existing.id)) continue;
      seenBookingIds.add(existing.id);
      const status = String(existing.status || 'pending').toLowerCase();
      if (INACTIVE_BOOKING_STATUSES.has(status)) continue;
      const existingSlot = parseServerBookingDateTime(existing.dateTime);
      if (!existingSlot || existingSlot.dateKey !== requestedSlot.dateKey) continue;
      const overlaps =
        requestedSlot.startMin < existingSlot.endMin &&
        requestedSlot.endMin > existingSlot.startMin;
      if (overlaps) {
        return res.status(409).json({
          error: 'Ese horario ya se encuentra reservado. Por favor elige otro horario disponible.',
          code: 'SLOT_ALREADY_BOOKED'
        });
      }
    }
  }

  const pkg = runtimeDB.packages.find(p => p.id === packageId) || runtimeDB.packages[0];

  // El precio lo decide el SERVIDOR entre un mínimo y un máximo legítimos:
  //  - se ignoran los valores manipulados (por ejemplo reservar por $1),
  //  - se respetan las combinaciones válidas (impresiones, retablos, fidelidad),
  //  - el descuento de recurrencia se comprueba aquí, no en el navegador.
  const { finalPrice, band, priceCheck, referralApplied } = resolveBookingPrice({ db: runtimeDB, pkg, body: req.body });
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
    referredBy: req.body.referralCode ? String(req.body.referralCode).trim() : null,
    referralDiscountApplied: Boolean(referralApplied),
    receiptToken,
    createdAt: new Date().toISOString(),
    status: 'pending',
    isReal: true
  };

  runtimeDB.bookings.unshift(newBooking);

  // En Vercel Serverless, res.json() congela el proceso inmediatamente y descarta
  // cualquier promesa no resuelta. Es mandatorio esperar la sincronización a MongoDB Atlas,
  // el envío de correos y la notificación push con Promise.allSettled antes de responder:
  await Promise.allSettled([
    persistBookingToMongo(newBooking).catch(e => {
      console.warn('MongoDB booking sync error:', e?.message || e);
      return null;
    }),
    recordFinancialAuditLog({
      action: 'booking_created',
      actor: 'public_client',
      entityType: 'booking',
      entityId: newBooking.id,
      amount: newBooking.totalPrice,
      status: newBooking.status,
      ip: clientIp
    }, { runtimeDB, isMongoConfigured, upsertMongoDoc }),
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
  ]);

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
  if (!checkPublicWriteRateLimit(getClientIp(req), 20, 'send-email')) {
    return res.status(429).json({ error: 'Límite de envío de correos alcanzado temporalmente. Intenta en unos minutos.' });
  }
  const { type, data } = req.body || {};
  try {
    if (type === '2fa_code') {
      const ok = await sendTwoFactorCodeEmail(data?.code, data?.targetEmail);
      return res.json({ success: ok, message: ok ? 'Código de seguridad 2FA enviado por correo' : 'No se pudo enviar el correo' });
    } else if (type === 'booking_confirmation') {
      const ok = await sendBookingConfirmedEmail(data.booking, data.customNotes);
      return res.json({ success: ok, message: ok ? 'Correo de confirmación enviado' : 'No se pudo enviar el correo' });
    } else if (type === 'session_completed') {
      const ok = await sendSessionCompletedEmail(data.booking, data.customNotes);
      return res.json({ success: ok, message: ok ? 'Correo de sesión realizada enviado' : 'No se pudo enviar el correo' });
    } else if (type === 'photo_delivery') {
      const ok = await sendPhotoDeliveryEmail(data);
      return res.json({ success: ok, message: ok ? 'Fotos enviadas por correo al cliente' : 'No se pudo enviar el correo' });
    } else if (type === 'payment_receipt') {
      const result = await sendPaymentReceiptEmail(data);
      return res.json({
        success: Boolean(result?.sent),
        ...result,
        message: result?.sent
          ? `Comprobante ${result.voucherNum || ''} enviado con éxito al correo del cliente`
          : (result?.reason === 'no_email' ? 'El cliente no tiene correo registrado' : 'No se pudo enviar el correo')
      });
    } else if (type === 'test') {
      const ok = await sendNewBookingEmails(data?.booking || {
        clientName: 'Cliente de Prueba',
        clientWhatsApp: '+57 300 000 0000',
        clientEmail: 'reservas@sebastiang.app',
        packageName: '8 Fotos Digitales',
        dateTime: 'Hoy a las 4:00 PM',
        specificLocation: 'Locación Acordada',
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
  if (!checkPublicWriteRateLimit(getClientIp(req), 60, 'gallery-read')) {
    return res.status(429).json({ error: 'Demasiadas consultas de galería. Intenta en unos minutos.' });
  }
  const { token } = req.params;
  if (!isValidGalleryTokenFormat(token)) {
    return res.status(404).json({ error: 'Galería no encontrada.' });
  }
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

  // MongoDB Atlas (fuente única de verdad)
  if (!session && token !== 'demo-cliente-2026' && isMongoConfigured()) {
    try {
      const doc = await findMongoDoc('sessions', { token });
      if (doc) {
        const { _id, ...cleanSession } = doc;
        session = cleanSession;
        runtimeDB.sessions = runtimeDB.sessions || [];
        if (!runtimeDB.sessions.some(s => s.token === token)) {
          runtimeDB.sessions.push(session);
        }
      }
    } catch (errMongo) {
      console.warn('⚠️ [MongoDB] Error consultando sesión:', errMongo?.message || errMongo);
    }
  }

  if (!session) return res.status(404).json({ error: 'Galería no encontrada.' });
  if (session.revoked || session.status === 'revoked') {
    return res.status(403).json({ error: 'El acceso a esta galería privada ha sido revocado por el estudio.' });
  }

  const now = Date.now();
  const expiresTime = session.expiresAt ? new Date(session.expiresAt).getTime() : 0;
  const isExpired = expiresTime > 0 && now > expiresTime;
  const isSubmitted = session.status === 'submitted' || session.status === 'delivered';
  const isDelivered = session.status === 'delivered';

  // Si la sesión expiró y no ha sido entregada, el servidor NO envía fotos
  const photos = (isExpired && !isDelivered) ? [] : (session.photos || []);

  res.json({
    ...session,
    photos,
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
  if (!checkPublicWriteRateLimit(getClientIp(req), 120, 'gallery-live')) {
    return res.status(429).json({ error: 'Demasiadas actualizaciones simultáneas. Intenta en unos segundos.' });
  }
  try {
    const { token } = req.params;
    if (!isValidGalleryTokenFormat(token)) {
      return res.status(404).json({ error: 'Galería no encontrada.' });
    }
    const { selections, selectedCount } = req.body || {};
    let session = (runtimeDB.sessions || []).find(s => s.token === token);

    if (!session && isMongoConfigured()) {
      try {
        const doc = await findMongoDoc('sessions', { token });
        if (doc) {
          const { _id, ...cleanSession } = doc;
          session = cleanSession;
          runtimeDB.sessions = runtimeDB.sessions || [];
          if (!runtimeDB.sessions.some(s => s.token === token)) {
            runtimeDB.sessions.push(session);
          }
        }
      } catch (errMongo) {}
    }

    if (session) {
      if (session.revoked || session.status === 'revoked') {
        return res.status(403).json({ error: 'El acceso a esta galería privada ha sido revocado.' });
      }
      const now = Date.now();
      const expiresTime = session.expiresAt ? new Date(session.expiresAt).getTime() : 0;
      if (expiresTime > 0 && now > expiresTime && session.status !== 'delivered') {
        return res.status(410).json({ error: 'La vigencia de 3 días de esta sesión ha expirado.' });
      }

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

      // Guardar en MongoDB Atlas
      if (isMongoConfigured()) {
        try {
          await upsertMongoDoc('sessions', { token }, session);
        } catch (eMongo) {
          console.warn('⚠️ [MongoDB] Error actualizando live selection:', eMongo?.message || eMongo);
        }
      }
    }
    res.json({ success: true, selectedCount: session?.selectedCount || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gallery/:token/submit', async (req, res) => {
  if (!checkPublicWriteRateLimit(getClientIp(req), 12, 'gallery-submit')) {
    return res.status(429).json({ error: 'Demasiados intentos de envío. Espera unos minutos.' });
  }
  const { token } = req.params;
  if (!isValidGalleryTokenFormat(token)) {
    return res.status(404).json({ error: 'Sesión no encontrada.' });
  }
  const { selections } = req.body;
  let session = (runtimeDB.sessions || []).find(s => s.token === token);

  if (!session && isMongoConfigured()) {
    try {
      const doc = await findMongoDoc('sessions', { token });
      if (doc) {
        const { _id, ...cleanSession } = doc;
        session = cleanSession;
        runtimeDB.sessions = runtimeDB.sessions || [];
        if (!runtimeDB.sessions.some(s => s.token === token)) {
          runtimeDB.sessions.push(session);
        }
      }
    } catch (errMongo) {}
  }

  if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });
  if (session.revoked || session.status === 'revoked') {
    return res.status(403).json({ error: 'El acceso a esta galería privada ha sido revocado.' });
  }
  const now = Date.now();
  const expiresTime = session.expiresAt ? new Date(session.expiresAt).getTime() : 0;
  if (expiresTime > 0 && now > expiresTime && session.status !== 'delivered') {
    return res.status(410).json({ error: 'La vigencia de 3 días de esta sesión ha expirado. Por favor contacta a Sebastian G para reactivarla.' });
  }
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

  // Guardar en MongoDB Atlas
  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('sessions', { token }, session);
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error guardando selección enviada:', eMongo?.message || eMongo);
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

  await sendOneSignalPush({
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
async function getActiveAdminScryptHash() {
  if (runtimeDB.settings?.adminPinScrypt) {
    return runtimeDB.settings.adminPinScrypt;
  }
  // MongoDB Atlas (fuente única de verdad)
  if (isMongoConfigured()) {
    try {
      const secDoc = await findMongoDoc('security', { id: 'system_admin_pin_hash' });
      if (secDoc?.scryptHash) {
        runtimeDB.settings = runtimeDB.settings || {};
        runtimeDB.settings.adminPinScrypt = secDoc.scryptHash;
        return secDoc.scryptHash;
      }
    } catch (eMongo) {
      console.warn('Aviso leyendo system_admin_pin_hash de MongoDB:', eMongo?.message || eMongo);
    }
  }
  return process.env.ADMIN_PIN_SCRYPT || '';
}

app.post('/api/admin/auth', async (req, res) => {
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
  const activeScrypt = await getActiveAdminScryptHash();
  const hasConfiguredPin = Boolean(activeScrypt || process.env.ADMIN_PIN_HASH || runtimeDB.settings.adminPinHash);
  const effectiveSha = process.env.ADMIN_PIN_HASH || runtimeDB.settings.adminPinHash || (!hasConfiguredPin ? KNOWN_WEAK_PIN_HASH : '');

  if (!hasConfiguredPin || isWeakConfiguredPin(effectiveSha)) {
    console.warn('⚠️ [Seguridad] No se ha configurado un PIN robusto aún. Usa ADMIN_PIN_SCRYPT o cámbialo en el Dashboard.');
  }

  const pinOk = verifyAdminPin(pin, {
    scryptHash: activeScrypt,
    sha256Hash: effectiveSha
  });

  if (!pinOk) {
    recordOperationalEvent('failedAdminLogins', `PIN incorrecto desde IP ${ip}`, 'warning');
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

  // Login exitoso: token firmado (HMAC-SHA256) con passwordVersion activa
  resetLoginAttempts(ip);
  try {
    const activeVersion = await getActivePasswordVersionFromStore({ runtimeDB });
    const token = createAdminToken({ pwd: activeVersion });
    const bioRefreshToken = createBioRefreshToken({ pwd: activeVersion });
    return res.json({ success: true, token, bioRefreshToken, expiresInMs: 12 * 60 * 60 * 1000 });
  } catch (e) {
    console.error('[Seguridad] No se pudo emitir la sesión:', e?.message || e);
    return res.status(503).json({ error: 'El servidor no tiene configurado ADMIN_AUTH_SECRET.' });
  }
});

// Renovación de sesión rápida mediante huella biométrica
app.post('/api/admin/auth/bio-refresh', async (req, res) => {
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Demasiados intentos. Bloqueado por ${rateCheck.retryAfterMin} minutos.`,
      retryAfterMs: rateCheck.retryAfterMs
    });
  }

  try {
    const rawToken = readAdminToken(req) || req.body?.bioRefreshToken;
    const payload = verifyBioRefreshToken(rawToken);
    if (!payload) {
      recordFailedLogin(ip);
      return res.status(401).json({ error: 'Sesión biométrica no válida o expirada. Ingresa con tu PIN.' });
    }

    const activeVersion = await getActivePasswordVersionFromStore({ runtimeDB });

    if (payload.pwd !== activeVersion) {
      return res.status(401).json({ error: 'La contraseña fue cambiada. Ingresa con tu nueva contraseña.' });
    }

    const freshToken = createAdminToken({ pwd: activeVersion });
    return res.json({ success: true, token: freshToken, expiresInMs: 12 * 60 * 60 * 1000 });
  } catch (err) {
    console.error('[Seguridad] Error en renovación biométrica:', err);
    return res.status(500).json({ error: 'Error procesando renovación biométrica.' });
  }
});

// ==============================================================================
// RUTAS PÚBLICAS DE RECUPERACIÓN DE CONTRASEÑA ADMIN (ZOHO SMTP)
// ==============================================================================
app.post('/api/admin/password/reset-request', async (req, res) => {
  return handlePasswordResetRequest(req, res, { runtimeDB });
});

app.post('/api/admin/password/reset-confirm', async (req, res) => {
  return handlePasswordResetConfirm(req, res, { runtimeDB });
});

// ==============================================================================
// A PARTIR DE AQUÍ, TODO /api/admin/* EXIGE UNA SESIÓN FIRMADA VÁLIDA
// ==============================================================================
app.use('/api/admin', (req, res, next) => {
  if (req.path === '/auth' || req.path === '/auth/bio-refresh' || req.path.startsWith('/password/')) return next();
  return requireAdminAuth(req, res, next);
});

app.get('/api/admin/bookings', async (req, res) => {
  try {
    const map = new Map();
    (runtimeDB.bookings || []).forEach(b => {
      const norm = normalizeBookingDoc(b);
      if (norm) map.set(norm.id, norm);
    });

    // MongoDB Atlas (fuente única de verdad)
    if (isMongoConfigured()) {
      try {
        const mongoBookings = await findMongoDocs('bookings', {}, { createdAt: -1 });
        if (Array.isArray(mongoBookings)) {
          mongoBookings.forEach(b => {
            if (b && b.id) {
              const { _id, ...cleanBooking } = b;
              const norm = normalizeBookingDoc(cleanBooking);
              if (norm) {
                const existing = map.get(norm.id);
                map.set(norm.id, existing ? mergeBookingObjectsServer(existing, norm) : norm);
              }
            }
          });
        }
      } catch (errMongo) {
        console.warn('⚠️ [MongoDB] Error recuperando reservas:', errMongo?.message || errMongo);
      }
    }

    runtimeDB.bookings = Array.from(map.values()).map(b => normalizeBookingDoc(b)).filter(Boolean);
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
  const updates = req.body || {};
  const supaId = id.startsWith('book-') ? id : `book-${id}`;

  let booking = (runtimeDB.bookings || []).find(b => b.id === id || b.id === supaId);

  // Si no está en memoria (cold start u otra instancia de serverless), recuperarla
  // del almacén persistente ANTES de fusionar. Esto evita que una actualización
  // parcial (p. ej. { status: 'confirmed' }) cree una reserva rota sin nombre ni
  // precio y sobrescriba la reserva real en la base de datos.
  if (!booking && isMongoConfigured()) {
    try {
      const doc = await findMongoDoc('bookings', { $or: [{ id }, { id: supaId }, { supaId }] });
      if (doc) {
        const { _id, supaId: _s, ...cleanBooking } = doc;
        booking = normalizeBookingDoc(cleanBooking);
      }
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error buscando reserva para actualizar:', eMongo?.message || eMongo);
    }
  }

  if (!booking) {
    booking = normalizeBookingDoc({ id, ...updates, isReal: true });
    if (!runtimeDB.bookings) runtimeDB.bookings = [];
    runtimeDB.bookings.unshift(booking);
  } else {
    booking = mergeBookingObjectsServer(booking, updates);
    const idx = (runtimeDB.bookings || []).findIndex(b => b.id === id || b.id === supaId);
    if (idx !== -1) runtimeDB.bookings[idx] = booking;
  }

  await persistBookingToMongo(booking).catch(e => console.warn('MongoDB sync error:', e));
  await recordFinancialAuditLog({
    action: 'booking_updated',
    actor: 'admin',
    entityType: 'booking',
    entityId: booking.id,
    amount: booking.totalPrice,
    status: booking.status,
    ip: getClientIp(req)
  }, { runtimeDB, isMongoConfigured, upsertMongoDoc });
  res.json({ success: true, booking });
});

app.delete('/api/admin/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const supaId = id.startsWith('book-') ? id : `book-${id}`;
  runtimeDB.bookings = (runtimeDB.bookings || []).filter(b => b.id !== id && b.id !== supaId);

  if (isMongoConfigured()) {
    try {
      await deleteMongoDoc('bookings', { $or: [{ id }, { id: supaId }, { supaId }] });
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error eliminando reserva:', eMongo?.message || eMongo);
    }
  }
  await recordFinancialAuditLog({
    action: 'booking_deleted',
    actor: 'admin',
    entityType: 'booking',
    entityId: id,
    ip: getClientIp(req)
  }, { runtimeDB, isMongoConfigured, upsertMongoDoc });
  res.json({ success: true });
});

// ==============================================================================
// PASARELAS DE PAGO
// ==============================================================================
app.get('/api/admin/payments', async (req, res) => {
  const map = new Map();
  (runtimeDB.payments || []).forEach(p => { if (p && p.id) map.set(p.id, p); });

  if (isMongoConfigured()) {
    try {
      const mongoPayments = await findMongoDocs('payments', {}, { createdAt: -1 });
      if (Array.isArray(mongoPayments)) {
        mongoPayments.forEach(p => {
          if (p && p.id) {
            const { _id, ...cleanPayment } = p;
            const existing = map.get(cleanPayment.id);
            map.set(cleanPayment.id, existing ? { ...existing, ...cleanPayment } : cleanPayment);
          }
        });
      }
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error cargando pagos:', eMongo?.message || eMongo);
    }
  }

  runtimeDB.payments = Array.from(map.values());
  res.json(runtimeDB.payments);
});

app.post('/api/payments', async (req, res) => {
  if (!checkPublicWriteRateLimit(getClientIp(req), 15, 'payments')) {
    return res.status(429).json({ error: 'Demasiados registros de pago desde tu conexión. Intenta nuevamente en unos minutos.' });
  }
  const {
    clientName, clientWhatsApp, sessionToken, packageTitle, amount, method,
    reference, voucherUrl, extraPhotosCount, printedPhotosCount,
    printedPhotos10x15Count, printedPhotos15x20Count, retablosCount,
    printedSizes, paperPhotosSummary, retablosSummary, printedPhotosSummary,
    status, concept
  } = req.body;

  if (voucherUrl) {
    const voucherCheck = validateImagePayload(voucherUrl, { maxBytes: DEFAULT_MAX_VOUCHER_BYTES });
    if (!voucherCheck.valid) {
      return res.status(400).json({ error: `Comprobante inválido: ${voucherCheck.error}` });
    }
  }

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

  // Guardar en MongoDB Atlas (fuente única de verdad)
  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('payments', { id: newPayment.id }, newPayment);
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error guardando pago:', eMongo?.message || eMongo);
    }
  }

  await recordFinancialAuditLog({
    action: 'payment_registered',
    actor: isAdminCaller ? 'admin' : 'public_client',
    entityType: 'payment',
    entityId: newPayment.id,
    amount: newPayment.amount,
    status: newPayment.status,
    ip: getClientIp(req),
    metadata: { method: newPayment.method, reference: newPayment.reference }
  }, { runtimeDB, isMongoConfigured, upsertMongoDoc });

  await sendOneSignalPush({
    title: '💰 ¡Nuevo Pago Registrado!',
    message: `${newPayment.clientName} registró pago de $${newPayment.amount.toLocaleString('es-CO')} COP (${methodName})`,
    url: 'https://sebastiang.app/?mode=admin',
    data: { type: 'payment', paymentId: newPayment.id }
  }).catch(err => console.error('Error OneSignal Push pago:', err?.message || err));

  res.status(201).json({
    success: true,
    payment: newPayment,
    directWhatsAppUrl: `https://wa.me/${photogWhatsApp1}?text=${msgText}`,
    secondaryWhatsAppUrl: `https://wa.me/${photogWhatsApp2}?text=${msgText}`
  });
});

// ==============================================================================
// PASARELA WOMPI: CHECKOUT, WEBHOOK E IDEMPOTENCIA
// ==============================================================================

app.post('/api/payments/checkout', async (req, res) => {
  const ip = getClientIp(req);
  if (!checkCheckoutRateLimit(ip)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes de checkout. Intenta de nuevo en unos minutos.' });
  }

  // Fail-closed: sin secreto de integridad, la firma del checkout sería falsificable.
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || (process.env.NODE_ENV === 'test' ? 'test_integrity_secret' : '');
  if (!integritySecret) {
    console.error('⚠️ [Wompi Checkout] WOMPI_INTEGRITY_SECRET no configurada.');
    return res.status(503).json({ error: 'La pasarela de pagos no está disponible en este momento.' });
  }

  const {
    bookingId, sessionToken, concept = 'booking_deposit',
    amount, clientName, clientWhatsApp, clientEmail
  } = req.body || {};

  if (!bookingId && !sessionToken) {
    return res.status(400).json({ error: 'Se requiere bookingId o sessionToken para iniciar el checkout.' });
  }

  let booking = null;
  if (bookingId) {
    booking = await findBookingById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Reserva no encontrada para asociar el pago.' });
    }
  }

  let sessionRemaining = undefined;
  if (concept === 'session_balance' || concept === 'saldo_galeria') {
    sessionRemaining = Number(amount);
  }

  const check = validateCheckoutAmount({
    concept,
    amount,
    booking,
    sessionRemaining
  });

  if (!check.valid) {
    return res.status(400).json({
      error: check.error || 'Monto inválido para el concepto.',
      expectedAmount: check.expectedAmount
    });
  }

  const reference = generatePaymentReference('wompi');
  const amountInCents = Number(amount) * 100;
  const currency = 'COP';

  const paymentRecord = {
    id: `pay-wompi-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    bookingId: booking?.id || bookingId || null,
    sessionToken: sessionToken || '',
    clientName: (clientName || booking?.clientName || 'Cliente').trim(),
    clientWhatsApp: (clientWhatsApp || booking?.clientWhatsApp || '').trim(),
    clientEmail: (clientEmail || booking?.clientEmail || '').trim(),
    packageTitle: booking?.packageName || 'Sesión Fotográfica',
    amount: Number(amount),
    amountInCents,
    currency,
    method: 'wompi',
    gatewayProvider: 'wompi',
    reference,
    concept,
    status: 'pending_gateway',
    createdAt: new Date().toISOString()
  };

  if (!runtimeDB.payments) runtimeDB.payments = [];
  runtimeDB.payments.unshift(paymentRecord);

  // Persistencia inmediata en MongoDB Atlas
  await persistPaymentToMongo(paymentRecord);
  await recordFinancialAuditLog({
    action: 'wompi_checkout_created',
    actor: 'public_client',
    entityType: 'payment',
    entityId: paymentRecord.id,
    amount: paymentRecord.amount,
    status: paymentRecord.status,
    ip,
    metadata: { reference, concept, bookingId: paymentRecord.bookingId }
  }, { runtimeDB, isMongoConfigured, upsertMongoDoc });

  let signature = '';
  try {
    signature = generateWompiSignature({
      reference,
      amountInCents,
      currency,
      integritySecret
    });
  } catch (err) {
    console.error('Error generando firma de Wompi:', err);
  }

  const publicKey = process.env.WOMPI_PUBLIC_KEY || '';
  const redirectUrl = encodeURIComponent(`https://sebastiang.app/?payment_success=true&ref=${reference}`);
  const checkoutUrl = `https://checkout.wompi.co/p/?public-key=${publicKey}&currency=${currency}&amount-in-cents=${amountInCents}&reference=${reference}&signature:integrity=${signature}&redirect-url=${redirectUrl}`;

  return res.status(201).json({
    success: true,
    paymentId: paymentRecord.id,
    reference,
    amount: paymentRecord.amount,
    amountInCents,
    currency,
    signature,
    publicKey,
    checkoutUrl
  });
});

app.post('/api/payments/webhook', async (req, res) => {
  if (!checkPublicWriteRateLimit(getClientIp(req), 60, 'wompi-webhook')) {
    return res.status(429).json({ error: 'Demasiadas solicitudes al webhook de pagos.' });
  }

  const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
  if (!eventsSecret) {
    console.error('⚠️ [Wompi Webhook] WOMPI_EVENTS_SECRET no configurada.');
    return res.status(503).json({ error: 'WOMPI_EVENTS_SECRET no configurada en el servidor.' });
  }

  const isValid = verifyWompiChecksum({ eventPayload: req.body, eventsSecret });
  if (!isValid) {
    console.warn('⚠️ [Wompi Webhook] Firma de evento inválida o manipulada.');
    return res.status(401).json({ error: 'Firma de webhook inválida.' });
  }

  const tx = req.body?.data?.transaction;
  if (!tx || !tx.reference) {
    return res.status(400).json({ error: 'Payload sin información de transacción o referencia.' });
  }

  const payment = await findPaymentByReference(tx.reference, tx.id);
  if (!payment) {
    console.warn(`[Wompi Webhook] Pago con referencia ${tx.reference} no encontrado.`);
    return res.status(404).json({ error: 'Pago con la referencia proporcionada no encontrado.' });
  }

  // Idempotencia y protección de máquina de estados:
  // 1) Si el evento entrante coincide con el estado actual, responder 200 sin duplicar acciones.
  // 2) Si un pago ya está verificado/aprobado, jamás puede ser degradado a rechazado por un evento tardío.
  const isCurrentlyVerified = payment.status === 'verified' || payment.status === 'approved';
  const isCurrentlyRejected = payment.status === 'rejected';
  const isIncomingTerminalFail = ['DECLINED', 'VOIDED', 'ERROR'].includes(tx.status);

  if (isCurrentlyVerified || (isCurrentlyRejected && isIncomingTerminalFail)) {
    return res.status(200).json({
      success: true,
      idempotent: true,
      message: 'Transacción ya procesada previamente en estado final (idempotente).',
      reference: payment.reference
    });
  }

  // Verificación estricta de monto
  const expectedCents = Number(payment.amount) * 100;
  if (Number(tx.amount_in_cents) !== expectedCents) {
    console.error(`[Wompi Webhook] Discrepancia de monto: esperado ${expectedCents}, recibido ${tx.amount_in_cents}`);
    return res.status(400).json({ error: 'El monto de la transacción no coincide con el registro previo.' });
  }

  if (tx.status === 'APPROVED') {
    // Estado canónico unificado para toda la contabilidad del sistema
    payment.status = 'verified';
    payment.gatewayStatus = tx.status;
    payment.transactionId = tx.id;
    payment.paymentMethodType = tx.payment_method_type || 'WOMPI';
    payment.approvedAt = new Date().toISOString();

    const inMem = (runtimeDB.payments || []).find(p => p.id === payment.id);
    if (inMem) {
      Object.assign(inMem, payment);
    } else if (runtimeDB.payments) {
      runtimeDB.payments.unshift(payment);
    }

    let bookingToUpdate = null;
    if (payment.bookingId) {
      bookingToUpdate = await findBookingById(payment.bookingId);
      if (bookingToUpdate) {
        if (bookingToUpdate.status === 'pending') {
          bookingToUpdate.status = 'confirmed';
        }
        bookingToUpdate.depositPaid = true;
        const inMemB = (runtimeDB.bookings || []).find(b => b.id === bookingToUpdate.id);
        if (inMemB) Object.assign(inMemB, bookingToUpdate);
      }
    }

    await Promise.allSettled([
      persistPaymentToMongo(payment),
      bookingToUpdate ? persistBookingToMongo(bookingToUpdate) : Promise.resolve(),
      recordFinancialAuditLog({
        action: 'wompi_payment_approved',
        actor: 'wompi_webhook',
        entityType: 'payment',
        entityId: payment.id,
        amount: payment.amount,
        status: payment.status,
        ip: getClientIp(req),
        metadata: { reference: payment.reference, transactionId: tx.id }
      }, { runtimeDB, isMongoConfigured, upsertMongoDoc }),
      sendOneSignalPush({
        title: '💰 ¡Abono Confirmado en Wompi!',
        message: `${payment.clientName} pagó $${payment.amount.toLocaleString('es-CO')} COP (${payment.concept === 'booking_deposit' ? 'Abono de Reserva' : 'Saldo'})`,
        url: 'https://sebastiang.app/?mode=admin',
        data: { type: 'payment', paymentId: payment.id, reference: payment.reference, transactionId: tx.id }
      }).catch(e => console.warn('OneSignal push error:', e)),
      bookingToUpdate && bookingToUpdate.clientEmail ? sendBookingConfirmedEmail(bookingToUpdate, runtimeDB.settings).catch(e => console.warn('Email error:', e)) : Promise.resolve()
    ]);

    return res.status(200).json({ success: true, status: 'APPROVED', reference: payment.reference });
  } else if (tx.status === 'DECLINED' || tx.status === 'VOIDED' || tx.status === 'ERROR') {
    payment.status = 'rejected';
    payment.gatewayStatus = tx.status;
    payment.transactionId = tx.id;
    payment.rejectedAt = new Date().toISOString();

    const inMem = (runtimeDB.payments || []).find(p => p.id === payment.id);
    if (inMem) Object.assign(inMem, payment);

    let bookingToRevert = null;
    if (payment.bookingId) {
      bookingToRevert = await findBookingById(payment.bookingId);
      if (bookingToRevert) {
        bookingToRevert.depositPaid = false;
        const inMemB = (runtimeDB.bookings || []).find(b => b.id === bookingToRevert.id);
        if (inMemB) Object.assign(inMemB, bookingToRevert);
      }
    }

    await Promise.allSettled([
      persistPaymentToMongo(payment),
      bookingToRevert ? persistBookingToMongo(bookingToRevert) : Promise.resolve(),
      recordFinancialAuditLog({
        action: 'wompi_payment_rejected',
        actor: 'wompi_webhook',
        entityType: 'payment',
        entityId: payment.id,
        amount: payment.amount,
        status: payment.status,
        ip: getClientIp(req),
        metadata: { reference: payment.reference, transactionId: tx.id, gatewayStatus: tx.status }
      }, { runtimeDB, isMongoConfigured, upsertMongoDoc })
    ]);

    return res.status(200).json({ success: true, status: tx.status, reference: payment.reference });
  } else {
    return res.status(200).json({ success: true, status: tx.status });
  }
});

app.get('/api/payments/status/:reference', async (req, res) => {
  const { reference } = req.params;
  if (!reference) return res.status(400).json({ error: 'Referencia requerida.' });

  const payment = await findPaymentByReference(reference);
  if (!payment) return res.status(404).json({ error: 'Pago no encontrado.' });

  return res.json({
    success: true,
    reference: payment.reference,
    status: payment.status,
    concept: payment.concept,
    amount: payment.amount,
    currency: payment.currency || 'COP'
  });
});

app.patch('/api/admin/payments/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const cleanId = String(id);
  const supaId = cleanId.startsWith('pay-') ? cleanId : `pay-${cleanId}`;

  let payment = (runtimeDB.payments || []).find(p => p.id === cleanId || p.id === supaId);

  if (!payment && isMongoConfigured()) {
    try {
      const doc = await findMongoDoc('payments', { $or: [{ id: cleanId }, { id: supaId }] });
      if (doc) {
        const { _id, ...cleanDoc } = doc;
        payment = cleanDoc;
        if (!runtimeDB.payments) runtimeDB.payments = [];
        runtimeDB.payments.unshift(payment);
      }
    } catch (eMongo) {}
  }

  if (!payment) return res.status(404).json({ error: 'Pago no encontrado.' });
  payment.status = status;

  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('payments', { id: payment.id }, payment);
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error actualizando estado de pago:', eMongo?.message || eMongo);
    }
  }

  await recordFinancialAuditLog({
    action: 'payment_status_updated',
    actor: 'admin',
    entityType: 'payment',
    entityId: payment.id,
    amount: payment.amount,
    status: payment.status,
    ip: getClientIp(req)
  }, { runtimeDB, isMongoConfigured, upsertMongoDoc });

  res.json({ success: true, payment });
});

app.delete('/api/admin/payments/:id', async (req, res) => {
  const { id } = req.params;
  const cleanId = String(id);
  const supaId = cleanId.startsWith('pay-') ? cleanId : `pay-${cleanId}`;
  runtimeDB.payments = (runtimeDB.payments || []).filter(p => p.id !== cleanId && p.id !== supaId);

  if (isMongoConfigured()) {
    try {
      await deleteMongoDoc('payments', { $or: [{ id: cleanId }, { id: supaId }, { supaId }] });
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error eliminando pago:', eMongo?.message || eMongo);
    }
  }

  await recordFinancialAuditLog({
    action: 'payment_deleted',
    actor: 'admin',
    entityType: 'payment',
    entityId: cleanId,
    ip: getClientIp(req)
  }, { runtimeDB, isMongoConfigured, upsertMongoDoc });

  res.json({ success: true, id: cleanId });
});

app.get('/api/admin/sessions', async (req, res) => {
  const now = Date.now();
  const map = new Map();
  (runtimeDB.sessions || []).forEach(s => {
    if (s && s.id !== 'sess-demo' && s.token !== 'demo-cliente-2026') {
      map.set(s.token || s.id, s);
    }
  });

  if (isMongoConfigured()) {
    try {
      const mongoSessions = await findMongoDocs('sessions', {}, { createdAt: -1 });
      if (Array.isArray(mongoSessions)) {
        mongoSessions.forEach(s => {
          if (s && (s.token || s.id)) {
            const { _id, ...cleanSession } = s;
            const key = cleanSession.token || cleanSession.id;
            const existing = map.get(key);
            map.set(key, existing ? { ...existing, ...cleanSession } : cleanSession);
          }
        });
      }
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error cargando sesiones:', eMongo?.message || eMongo);
    }
  }

  const sessions = Array.from(map.values());
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

app.delete('/api/admin/sessions/:id', async (req, res) => {
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

  // Eliminar de MongoDB Atlas
  if (isMongoConfigured()) {
    try {
      await deleteMongoDoc('sessions', {
        $or: [
          { id: rawId },
          { token: rawId },
          { id: cleanId },
          { token: cleanId },
          { id: `sess-${cleanId}` },
          { token: `sess-${cleanId}` }
        ]
      });
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error eliminando sesión:', eMongo?.message || eMongo);
    }
  }
  res.json({ success: true });
});

app.post('/api/admin/sessions', async (req, res) => {
  const {
    clientName, clientWhatsApp, packageTitle, maxPhotosAllowed, photos,
    totalPrice, packagePrice, sessionBasePrice, bookingId, location
  } = req.body;

  if (!clientName || !clientWhatsApp || !photos || photos.length === 0) {
    return res.status(400).json({ error: 'Faltan datos del cliente o fotos para la sesión.' });
  }

  const photosBatchCheck = validateSessionPhotosBatch(photos);
  if (!photosBatchCheck.valid) {
    return res.status(400).json({ error: photosBatchCheck.error });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  // Token de la galería: aleatorio CRIPTOGRÁFICO (UUID v4) y sin el nombre del cliente.
  const token = generateGalleryToken();
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

  // Guardar en MongoDB Atlas
  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('sessions', { token: newSession.token }, newSession);
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error guardando sesión:', eMongo?.message || eMongo);
    }
  }

  res.status(201).json({
    success: true,
    session: newSession,
    link: `/galeria/${token}`
  });
});

app.post('/api/admin/sessions/:id/reopen', async (req, res) => {
  const { id } = req.params;
  const { additionalDays = 3, allowReSelection = true } = req.body;
  const session = (runtimeDB.sessions || []).find(s => s.id === id || s.token === id);
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });

  const newExpires = new Date(Date.now() + additionalDays * 24 * 60 * 60 * 1000);
  session.expiresAt = newExpires.toISOString();
  session.revoked = false;
  if (allowReSelection || session.status === 'revoked') {
    session.status = 'pending';
    session.submittedAt = null;
  }

  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('sessions', { token: session.token }, session);
    } catch (eMongo) {}
  }

  res.json({ success: true, session });
});

app.post('/api/admin/sessions/:id/revoke', async (req, res) => {
  const { id } = req.params;
  let session = (runtimeDB.sessions || []).find(s => s.id === id || s.token === id);
  if (!session && isMongoConfigured()) {
    try {
      const doc = await findMongoDoc('sessions', { $or: [{ id }, { token: id }] });
      if (doc) {
        const { _id, ...cleanSession } = doc;
        session = cleanSession;
        runtimeDB.sessions = runtimeDB.sessions || [];
        runtimeDB.sessions.push(session);
      }
    } catch (eMongo) {}
  }
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });

  session.revoked = true;
  session.status = 'revoked';
  session.revokedAt = new Date().toISOString();

  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('sessions', { token: session.token }, session);
    } catch (eMongo) {}
  }

  res.json({ success: true, session });
});

app.post('/api/admin/sessions/:id/deliver', async (req, res) => {
  const { id } = req.params;
  const { finalDeliveryUrl, deliveryService = 'wetransfer', deliveryNotes = '', finalPhotos = [] } = req.body;
  let session = (runtimeDB.sessions || []).find(s => s.id === id || s.token === id);

  if (!session && isMongoConfigured()) {
    try {
      const doc = await findMongoDoc('sessions', { $or: [{ id }, { token: id }] });
      if (doc) {
        const { _id, ...cleanSession } = doc;
        session = cleanSession;
        runtimeDB.sessions = runtimeDB.sessions || [];
        runtimeDB.sessions.push(session);
      }
    } catch (eMongo) {}
  }

  if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });

  session.status = 'delivered';
  session.finalDeliveryUrl = (finalDeliveryUrl || '').trim();
  session.deliveryService = deliveryService;
  session.deliveryNotes = (deliveryNotes || '').trim();
  session.deliveredAt = new Date().toISOString();
  if (Array.isArray(finalPhotos) && finalPhotos.length > 0) {
    session.finalPhotos = finalPhotos;
  }

  // Guardar en MongoDB Atlas
  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('sessions', { token: session.token }, session);
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error guardando entrega:', eMongo?.message || eMongo);
    }
  }

  res.json({ success: true, session });
});

app.post('/api/admin/settings', async (req, res) => {
  const { settings, packages } = req.body;
  if (settings) {
    // Nunca permitir que se sobreescriba el hash del PIN por este endpoint
    const { adminPin, adminPinHash, ...safeSettings } = settings;
    runtimeDB.settings = { ...runtimeDB.settings, ...safeSettings };
    if (isMongoConfigured()) {
      try {
        await upsertMongoDoc('settings', { id: 'app_settings' }, { id: 'app_settings', ...safeSettings });
      } catch (eMongo) {
        console.warn('⚠️ [MongoDB] Error guardando settings en admin:', eMongo?.message || eMongo);
      }
    }
  }
  if (packages && Array.isArray(packages)) {
    runtimeDB.packages = packages;
    if (isMongoConfigured()) {
      try {
        for (const pkg of packages) {
          if (pkg && pkg.id) {
            await upsertMongoDoc('packages', { id: pkg.id }, pkg);
          }
        }
      } catch (eMongo) {
        console.warn('⚠️ [MongoDB] Error guardando packages en admin:', eMongo?.message || eMongo);
      }
    }
  }
  res.json({ success: true, settings: runtimeDB.settings, packages: runtimeDB.packages });
});

// ==============================================================================
// GESTIÓN DE CATÁLOGO
// ==============================================================================
app.post('/api/admin/catalog', async (req, res) => {
  const { id, title, category, url, location } = req.body;
  if (!title || !url) {
    return res.status(400).json({ error: 'Faltan título o imagen de la foto.' });
  }
  const imgCheck = validateImagePayload(url, { maxBytes: DEFAULT_MAX_IMAGE_BYTES });
  if (!imgCheck.valid) {
    return res.status(400).json({ error: imgCheck.error });
  }
  const newItem = {
    id: id || `cat-${Date.now()}`,
    title: title.trim(),
    category: (category || 'Retratos').trim(),
    url: url.trim(),
    location: (location || 'Colombia').trim(),
    createdAt: new Date().toISOString()
  };
  if (!runtimeDB.catalog) runtimeDB.catalog = [];
  runtimeDB.catalog = runtimeDB.catalog.filter(c => c.id !== newItem.id && c.url !== newItem.url);
  runtimeDB.catalog.unshift(newItem);

  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('catalog', { id: newItem.id }, newItem);
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error guardando catálogo:', eMongo?.message || eMongo);
    }
  }

  res.status(201).json({ success: true, item: newItem });
});

app.delete('/api/admin/catalog/:id', async (req, res) => {
  const { id } = req.params;
  const bodyTitle = req.body && req.body.title ? req.body.title.trim().toLowerCase() : null;
  const target = (runtimeDB.catalog || []).find(c => c.id === id);
  const targetTitle = bodyTitle || (target?.title ? target.title.trim().toLowerCase() : null);
  runtimeDB.catalog = (runtimeDB.catalog || []).filter(c => {
    if (c.id === id) return false;
    if (targetTitle && c.title && c.title.trim().toLowerCase() === targetTitle) return false;
    return true;
  });

  if (isMongoConfigured()) {
    try {
      await deleteMongoDoc('catalog', { id });
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error eliminando catálogo:', eMongo?.message || eMongo);
    }
  }

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
// SEGURIDAD: CAMBIO DE CONTRASEÑA EN EL DASHBOARD (PERSISTENTE EN MONGODB ATLAS CON SCRYPT)
// ==============================================================================
app.post('/api/admin/pin/change', requireAdminAuth, async (req, res) => {
  const { currentPin, newPin } = req.body || {};
  if (!currentPin || !newPin) {
    return res.status(400).json({ error: 'Por favor completa la contraseña actual y la nueva contraseña.' });
  }

  const cleanCurrent = String(currentPin).trim();
  const cleanNew = String(newPin).trim();

  if (cleanNew.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres para máxima seguridad.' });
  }

  const activeScrypt = await getActiveAdminScryptHash();
  const effectiveSha = process.env.ADMIN_PIN_HASH || runtimeDB.settings?.adminPinHash || (!activeScrypt ? KNOWN_WEAK_PIN_HASH : '');

  const currentOk = verifyAdminPin(cleanCurrent, {
    scryptHash: activeScrypt,
    sha256Hash: effectiveSha
  });

  if (!currentOk) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
  }

  // Generar derivación scrypt bancaria de la nueva contraseña
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(cleanNew, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const newScryptHash = 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');

  // Incrementar passwordVersion y persistir hash
  const currentVersion = await getActivePasswordVersionFromStore({ runtimeDB });
  const newVersion = (currentVersion || 1) + 1;

  await updateAdminPasswordInStore({
    runtimeDB,
    newScryptHash,
    newVersion
  });

  await recordFinancialAuditLog({
    action: 'admin_password_changed',
    actor: 'admin',
    entityType: 'security',
    entityId: 'system_admin_pin_hash',
    status: `v${newVersion}`,
    ip: getClientIp(req)
  }, { runtimeDB, isMongoConfigured, upsertMongoDoc });

  // Alerta de seguridad por correo vía Zoho
  const targetEmail = getAdminEmail();
  try {
    await sendPasswordChangedAlertEmail(targetEmail, { ip: getClientIp(req) });
  } catch (alertErr) {
    console.warn('[Seguridad] Advertencia enviando alerta de cambio de clave:', alertErr?.message || alertErr);
  }

  return res.json({
    success: true,
    message: '✓ ¡Contraseña actualizada con éxito! Ya puedes usarla en todos tus dispositivos.'
  });
});

// ==============================================================================
// TOKENS DE DISPOSITIVO APK (ALCANCE EXCLUSIVO apk_feed:read, ROTATIVOS Y REVOCABLES)
// ==============================================================================
app.post('/api/admin/apk-devices/register', requireAdminAuth, async (req, res) => {
  try {
    const deviceName = String(req.body?.deviceName || 'Android APK').trim().slice(0, 80);
    const deviceId = String(req.body?.deviceId || `apk-${crypto.randomBytes(6).toString('hex')}`).trim().slice(0, 64);
    const activeVersion = await getActivePasswordVersionFromStore({ runtimeDB });
    const issued = createApkDeviceToken({
      deviceId,
      deviceName,
      pwd: activeVersion
    });

    await recordFinancialAuditLog({
      action: 'apk_device_registered',
      actor: 'admin',
      entityType: 'apk_device',
      entityId: issued.deviceId,
      status: 'active',
      ip: getClientIp(req),
      metadata: { deviceName: issued.deviceName, expiresAt: issued.expiresAt }
    }, { runtimeDB, isMongoConfigured, upsertMongoDoc });

    return res.status(201).json({
      success: true,
      deviceId: issued.deviceId,
      deviceName: issued.deviceName,
      scope: 'apk_feed:read',
      expiresAt: issued.expiresAt,
      deviceToken: issued.token
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'No se pudo emitir el token de dispositivo APK.' });
  }
});

app.post('/api/admin/apk-devices/revoke', requireAdminAuth, async (req, res) => {
  const deviceId = String(req.body?.deviceId || '').trim();
  if (!deviceId) {
    return res.status(400).json({ error: 'Se requiere deviceId para revocar el dispositivo.' });
  }
  runtimeDB.settings = runtimeDB.settings || {};
  const currentRevoked = Array.isArray(runtimeDB.settings.revokedApkDeviceIds)
    ? runtimeDB.settings.revokedApkDeviceIds
    : [];
  if (!currentRevoked.includes(deviceId)) {
    currentRevoked.push(deviceId);
  }
  runtimeDB.settings.revokedApkDeviceIds = currentRevoked;

  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('settings', { id: 'app_settings' }, {
        id: 'app_settings',
        revokedApkDeviceIds: currentRevoked
      });
    } catch (eMongo) {}
  }

  await recordFinancialAuditLog({
    action: 'apk_device_revoked',
    actor: 'admin',
    entityType: 'apk_device',
    entityId: deviceId,
    status: 'revoked',
    ip: getClientIp(req)
  }, { runtimeDB, isMongoConfigured, upsertMongoDoc });

  return res.json({
    success: true,
    revokedDeviceId: deviceId,
    revokedApkDeviceIds: currentRevoked
  });
});

// ==============================================================================
// AUDITORÍA FINANCIERA, MONITOREO Y RESPALDO / RESTAURACIÓN MONGODB ATLAS
// ==============================================================================
app.get('/api/admin/audit-logs', requireAdminAuth, async (req, res) => {
  let logs = Array.isArray(runtimeDB.auditLogs) ? [...runtimeDB.auditLogs] : [];
  if (isMongoConfigured()) {
    try {
      const mongoLogs = await findMongoDocs('audit_logs', {}, { createdAt: -1 }, 100);
      if (Array.isArray(mongoLogs) && mongoLogs.length > 0) {
        const seen = new Set();
        logs = [...mongoLogs.map(({ _id, ...l }) => l), ...logs].filter(item => {
          if (!item?.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      }
    } catch (eMongo) {
      recordOperationalEvent('mongoErrors', `Error leyendo audit_logs: ${eMongo?.message || eMongo}`, 'warning');
    }
  }
  const activeLogs = pruneExpiredAuditLogs(logs);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return res.json({
    success: true,
    retentionDays: AUDIT_LOG_RETENTION_DAYS,
    logs: activeLogs.slice(0, 100)
  });
});

app.get('/api/admin/backup', requireAdminAuth, async (req, res) => {
  const clientIp = getClientIp(req);
  if (!checkPublicWriteRateLimit(clientIp, 10, 'admin-backup-export')) {
    return res.status(429).json({ error: 'Límite de exportación de backups alcanzado temporalmente. Intenta en unos minutos.' });
  }

  const exportedAt = new Date().toISOString();
  const dateStamp = exportedAt.slice(0, 10);
  const rawUrl = String(req.originalUrl || req.url || '');
  const shouldEncrypt =
    req.query?.encrypt === '1' ||
    req.query?.encrypt === 'true' ||
    rawUrl.includes('encrypt=1') ||
    rawUrl.includes('encrypt=true');

  // Sanitizar estrictamente: nunca exportar hashes de PIN, retos de reseteo ni secretos
  const cleanSnapshot = sanitizeBackupSnapshot({
    settings: runtimeDB.settings || {},
    packages: runtimeDB.packages || [],
    catalog: runtimeDB.catalog || [],
    bookings: runtimeDB.bookings || [],
    payments: runtimeDB.payments || [],
    sessions: runtimeDB.sessions || [],
    reviews: runtimeDB.reviews || []
  });

  recordOperationalEvent('backupExports', `Backup exportado por admin (${shouldEncrypt ? 'AES-256-GCM' : 'JSON'})`, 'info');
  await recordFinancialAuditLog({
    action: 'database_backup_exported',
    actor: 'admin',
    entityType: 'system',
    entityId: 'mongodb_snapshot',
    status: shouldEncrypt ? 'encrypted_aes256gcm' : 'sanitized_json',
    ip: clientIp,
    details: {
      bookingsCount: cleanSnapshot.bookings.length,
      paymentsCount: cleanSnapshot.payments.length,
      sessionsCount: cleanSnapshot.sessions.length,
      encrypted: shouldEncrypt
    }
  }, { runtimeDB, isMongoConfigured, upsertMongoDoc });

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Disposition', `attachment; filename="sebastiang-backup-${dateStamp}.json"`);

  if (shouldEncrypt) {
    const encryptedEnvelope = encryptBackupPayload(cleanSnapshot);
    return res.json({
      success: true,
      exportedAt,
      sourceOfTruth: 'mongodb-atlas',
      encrypted: true,
      encryptedEnvelope
    });
  }

  return res.json({
    success: true,
    exportedAt,
    sourceOfTruth: 'mongodb-atlas',
    encrypted: false,
    snapshot: cleanSnapshot
  });
});

app.post('/api/admin/backup/restore', requireAdminAuth, async (req, res) => {
  const clientIp = getClientIp(req);
  if (!checkPublicWriteRateLimit(clientIp, 5, 'admin-backup-restore')) {
    return res.status(429).json({ error: 'Límite de restauración de backups alcanzado temporalmente.' });
  }

  const startMs = performance.now();
  try {
    let incomingSnapshot = req.body?.snapshot || null;
    if (req.body?.encryptedEnvelope) {
      incomingSnapshot = decryptBackupPayload(req.body.encryptedEnvelope);
    }

    if (!incomingSnapshot || typeof incomingSnapshot !== 'object') {
      return res.status(400).json({ error: 'Se requiere un snapshot válido o un encryptedEnvelope auténtico para restaurar.' });
    }

    const clean = sanitizeBackupSnapshot(incomingSnapshot);

    // Conservar intactos los parámetros críticos de seguridad actuales en memoria
    const preservedSecurity = {
      adminPinScrypt: runtimeDB.settings?.adminPinScrypt,
      adminPinHash: runtimeDB.settings?.adminPinHash,
      adminPasswordVersion: runtimeDB.settings?.adminPasswordVersion,
      adminResetChallenge: runtimeDB.settings?.adminResetChallenge,
      revokedApkDeviceIds: runtimeDB.settings?.revokedApkDeviceIds
    };

    runtimeDB.settings = {
      ...(runtimeDB.settings || {}),
      ...(clean.settings || {}),
      ...Object.fromEntries(Object.entries(preservedSecurity).filter(([, v]) => v !== undefined))
    };
    if (Array.isArray(clean.packages) && clean.packages.length > 0) {
      runtimeDB.packages = clean.packages;
    }
    runtimeDB.catalog = Array.isArray(clean.catalog) ? clean.catalog : [];
    runtimeDB.bookings = Array.isArray(clean.bookings)
      ? clean.bookings.map(b => normalizeBookingDoc(b)).filter(Boolean)
      : [];
    runtimeDB.payments = Array.isArray(clean.payments) ? clean.payments : [];
    runtimeDB.sessions = Array.isArray(clean.sessions) ? clean.sessions : [];
    runtimeDB.reviews = Array.isArray(clean.reviews) ? clean.reviews : [];

    if (isMongoConfigured()) {
      const ops = [];
      for (const b of runtimeDB.bookings) {
        if (b?.id) ops.push(persistBookingToMongo(b));
      }
      for (const p of runtimeDB.payments) {
        if (p?.id) ops.push(persistPaymentToMongo(p));
      }
      for (const s of runtimeDB.sessions) {
        if (s?.token) ops.push(upsertMongoDoc('sessions', { token: s.token }, s));
      }
      for (const r of runtimeDB.reviews) {
        if (r?.id) ops.push(upsertMongoDoc('reviews', { id: r.id }, r));
      }
      await Promise.allSettled(ops);
    }

    const recoveryTimeMs = Math.max(1, Math.round(performance.now() - startMs));
    const restoredCounts = {
      bookings: runtimeDB.bookings.length,
      payments: runtimeDB.payments.length,
      sessions: runtimeDB.sessions.length,
      catalog: runtimeDB.catalog.length,
      reviews: runtimeDB.reviews.length
    };

    recordOperationalEvent('backupRestores', `Backup restaurado en ${recoveryTimeMs} ms`, 'info');
    await recordFinancialAuditLog({
      action: 'database_backup_restored',
      actor: 'admin',
      entityType: 'system',
      entityId: 'mongodb_snapshot',
      status: 'restored',
      ip: clientIp,
      details: { recoveryTimeMs, ...restoredCounts }
    }, { runtimeDB, isMongoConfigured, upsertMongoDoc });

    return res.json({
      success: true,
      restoredAt: new Date().toISOString(),
      recoveryTimeMs,
      restoredCounts
    });
  } catch (err) {
    recordOperationalEvent('apiExceptions', `Fallo restaurando backup: ${err?.message || err}`, 'critical');
    return res.status(400).json({ error: err?.message || 'Error al restaurar el backup.' });
  }
});

app.get('/api/admin/monitoring/status', requireAdminAuth, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const report = getOperationalMonitoringReport({
    mongoConnected: isMongoConfigured(),
    runtimeDB
  });
  return res.json({
    success: true,
    ...report
  });
});

// ==============================================================================
// RESEÑAS
// ==============================================================================
app.get('/api/reviews', async (req, res) => {
  let reviews = runtimeDB.reviews || [];

  // MongoDB Atlas (fuente única de verdad)
  if (isMongoConfigured()) {
    try {
      const mongoReviews = await findMongoDocs('reviews', {}, { createdAt: -1 });
      if (Array.isArray(mongoReviews)) {
        const map = new Map();
        [...reviews, ...mongoReviews.map(({ _id, ...r }) => r)].forEach(rev => {
          if (rev && rev.id) map.set(rev.id, rev);
        });
        reviews = Array.from(map.values());
        runtimeDB.reviews = reviews;
      }
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error cargando reseñas:', eMongo?.message || eMongo);
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
  if (!checkPublicWriteRateLimit(getClientIp(req), 20, 'reviews')) {
    return res.status(429).json({ error: 'Demasiadas reseñas desde tu conexión. Intenta más tarde.' });
  }
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

  // Guardar en MongoDB Atlas
  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('reviews', { id: newReview.id }, newReview);
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error guardando reseña:', eMongo?.message || eMongo);
    }
  }

  await sendOneSignalPush({
    title: `⭐ ¡Nueva Calificación de ${newReview.clientName}!`,
    message: `${'⭐'.repeat(newReview.rating)} (${newReview.rating}/5) - "${newReview.comment.slice(0, 80)}"`,
    url: 'https://sebastiang.app/?mode=admin',
    data: { type: 'review', reviewId: newReview.id }
  }).catch(err => console.error('Error OneSignal Push reseña:', err));

  res.status(201).json({ success: true, review: newReview });
});

app.post('/api/gallery/:token/review', async (req, res) => {
  if (!checkPublicWriteRateLimit(getClientIp(req), 10, 'gallery-review')) {
    return res.status(429).json({ error: 'Demasiadas reseñas desde tu conexión. Intenta más tarde.' });
  }
  const { token } = req.params;
  if (!isValidGalleryTokenFormat(token)) {
    return res.status(404).json({ error: 'Galería no encontrada.' });
  }
  let session = (runtimeDB.sessions || []).find(s => s.token === token);
  if (!session && token !== 'demo-cliente-2026' && isMongoConfigured()) {
    try {
      const doc = await findMongoDoc('sessions', { token });
      if (doc) {
        const { _id, ...cleanSession } = doc;
        session = cleanSession;
      }
    } catch (eMongo) {}
  }
  if (!session && token !== 'demo-cliente-2026') {
    return res.status(404).json({ error: 'Galería no encontrada.' });
  }
  if (session && (session.revoked || session.status === 'revoked')) {
    return res.status(403).json({ error: 'El acceso a esta galería privada ha sido revocado.' });
  }

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

  // Guardar en MongoDB Atlas
  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('reviews', { id: newReview.id }, newReview);
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error guardando reseña desde galería:', eMongo?.message || eMongo);
    }
  }

  await sendOneSignalPush({
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

  // Eliminar de MongoDB Atlas
  if (isMongoConfigured()) {
    try {
      await deleteMongoDoc('reviews', { id });
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error eliminando reseña:', eMongo?.message || eMongo);
    }
  }
  res.json({ success: true, id });
});

// ==============================================================================
// WEBHOOK BOT WHATSAPP
// ==============================================================================
app.all('/api/bot-webhook', async (req, res) => {
  if (!checkPublicWriteRateLimit(getClientIp(req), 90)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes al bot.' });
  }
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
      await sendOneSignalPush({
        title: '💬 Cliente solicita hablar contigo',
        message: `${sender} quiere hablar con Sebastian G en WhatsApp`,
        url: 'https://sebastiang.app/?mode=admin'
      }).catch(err => console.error('Error push bot WhatsApp:', err?.message || err));
      replyText = `👨💼 *¡Entendido! Ya le avisé a Sebastian.* En unos minutos estará contigo.`;
    } else if (cleanMsg.includes('comprobante') || cleanMsg.includes('transfiri')) {
      await sendOneSignalPush({
        title: '💰 Comprobante enviado por WhatsApp',
        message: `${sender} indica que envió un comprobante`,
        url: 'https://sebastiang.app/?mode=admin'
      }).catch(err => console.error('Error push bot WhatsApp:', err?.message || err));
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

// ==============================================================================
// PROXY DE BASE DE DATOS AUTENTICADO (MongoDB Atlas — Fuente Única de Verdad)
// ==============================================================================
const DB_ALLOWED_TABLES = ['catalog', 'bookings', 'sessions', 'payments', 'reviews', 'system_config', 'settings', 'packages', 'vip_clients'];
const DB_ALLOWED_OPS = ['upsert', 'insert', 'update', 'delete', 'select'];

app.post('/api/admin/db', requireAdminAuth, async (req, res) => {
  const { table, op, payload, match } = req.body || {};

  if (!DB_ALLOWED_TABLES.includes(String(table))) {
    return res.status(400).json({ error: `Tabla no permitida: ${table}` });
  }
  if (!DB_ALLOWED_OPS.includes(String(op))) {
    return res.status(400).json({ error: `Operacion no permitida: ${op}` });
  }
  if ((op === 'update' || op === 'delete') && (!match || !Object.keys(match).length)) {
    return res.status(400).json({ error: 'Actualizar o borrar exige "match" para no afectar a toda la colección.' });
  }

  if (!isMongoConfigured()) {
    return res.status(503).json({ error: 'El servidor no tiene configurada MONGODB_URI para la base de datos en la nube.' });
  }

  try {
    const colName = table;
    if (op === 'select') {
      const docs = await findMongoDocs(colName, match || {});
      return res.json({ success: true, data: (docs || []).map(({ _id, ...d }) => d) });
    } else if (op === 'upsert' || op === 'insert') {
      const docToSave = table === 'bookings' ? (normalizeBookingDoc(payload) || payload) : payload;
      const filter = (docToSave && docToSave.id) ? { id: docToSave.id } : (match || {});
      await upsertMongoDoc(colName, filter, docToSave);
      return res.json({ success: true, data: [docToSave] });
    } else if (op === 'update') {
      const docToSave = table === 'bookings' ? (normalizeBookingDoc(payload) || payload) : payload;
      await upsertMongoDoc(colName, match || {}, docToSave);
      return res.json({ success: true, data: [docToSave] });
    } else if (op === 'delete') {
      await deleteMongoDoc(colName, match || {});
      return res.json({ success: true, data: [] });
    }
  } catch (eMongo) {
    console.warn('⚠️ [MongoDB] Error en /api/admin/db:', eMongo?.message || eMongo);
    return res.status(502).json({ error: 'Error ejecutando operación en MongoDB Atlas.' });
  }
});

// ==============================================================================
// CLIENTES VIP (MongoDB Atlas — colección vip_clients + memoria runtimeDB)
// ==============================================================================
app.get('/api/admin/vip', requireAdminAuth, async (req, res) => {
  if (isMongoConfigured()) {
    try {
      const docs = await findMongoDocs('vip_clients', {});
      if (docs && docs.length > 0) {
        return res.json(docs.map(({ _id, ...c }) => c));
      }
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error leyendo VIPs:', eMongo?.message || eMongo);
    }
  }
  return res.json(Array.isArray(runtimeDB.vipClients) ? runtimeDB.vipClients : []);
});

app.post('/api/admin/vip', requireAdminAuth, async (req, res) => {
  const { client, id } = req.body || {};
  if (!client || typeof client !== 'object') {
    return res.status(400).json({ error: 'Falta el objeto "client".' });
  }
  const phone = String(client.clientWhatsApp || client.phone || '').replace(/\D/g, '');
  const rowId = id || `vip-${phone}`;
  if (!phone && !id) return res.status(400).json({ error: 'El cliente necesita telefono o id.' });

  const vipDoc = { ...client, id: rowId };
  runtimeDB.vipClients = Array.isArray(runtimeDB.vipClients)
    ? [vipDoc, ...runtimeDB.vipClients.filter(v => v?.id !== rowId)]
    : [vipDoc];

  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('vip_clients', { id: rowId }, vipDoc);
    } catch (eMongo) {
      console.warn('⚠️ [MongoDB] Error guardando VIP:', eMongo?.message || eMongo);
    }
  }

  return res.json({ success: true, id: rowId });
});

app.delete('/api/admin/vip/:id', requireAdminAuth, async (req, res) => {
  const raw = String(req.params.id || '');
  const variants = [raw, raw.startsWith('vip-') ? raw : `vip-${raw}`, `vip-vip-${raw.replace(/^vip-/, '')}`];

  if (Array.isArray(runtimeDB.vipClients)) {
    runtimeDB.vipClients = runtimeDB.vipClients.filter(v => !variants.includes(v?.id));
  }

  if (isMongoConfigured()) {
    try {
      await deleteMongoDoc('vip_clients', { $or: variants.map(v => ({ id: v })) });
    } catch (eMongo) {}
  }

  return res.json({ success: true });
});

export default app;
