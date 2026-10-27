// ==============================================================================
// SEGURIDAD DEL SERVIDOR — tokens de sesión admin, PIN y escapado de HTML
// ==============================================================================
// Todo lo que decide "¿esta petición puede tocar datos del estudio?" vive aquí,
// en el servidor. El navegador ya no decide nada: solo envía el token que este
// módulo firmó.
//
// Usa únicamente `node:crypto` (sin dependencias nuevas).
// ==============================================================================

import crypto from 'crypto';

/** Secreto de sesión. NUNCA debe caer a un valor por defecto público. */
const FORBIDDEN_SECRETS = new Set([
  'fallback-dev-secret-change-me',
  'change-me',
  'secret',
  ''
]);

let warnedAboutSecret = false;

export function getAdminAuthSecret() {
  const secret = String(process.env.ADMIN_AUTH_SECRET || '').trim();
  const usable = secret.length >= 32 && !FORBIDDEN_SECRETS.has(secret);
  if (usable) return secret;

  // Respaldo SOLO con semillas privadas del servidor (nunca claves públicas del cliente).
  const seed = process.env.ADMIN_PIN_SCRYPT || process.env.MONGODB_URI || '';
  if (!seed) {
    // Sin semilla no se puede firmar ni verificar: se falla cerrado (401/503).
    return null;
  }
  console.warn('[Seguridad] ADMIN_AUTH_SECRET no definido: la clave de sesion se deriva de una semilla de servidor. Definelo para desacoplarla.');
  return crypto.createHash('sha256').update(`admin-auth-seed:${seed}`).digest('hex');
}

// ------------------------------------------------------------------------------
// Comparaciones y hashes
// ------------------------------------------------------------------------------

export function hashSHA256(str) {
  return crypto.createHash('sha256').update(String(str ?? '').trim()).digest('hex');
}

/** Comparación en tiempo constante, tolerante a longitudes distintas. */
export function secureCompare(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifica un PIN contra el hash configurado.
 * Acepta el hash en formato scrypt (`scrypt$sal$hash`, recomendado) o SHA-256
 * (compatibilidad). Si no hay hash configurado, RECHAZA: nunca debe existir un
 * PIN por defecto conocido.
 */
export function verifyAdminPin(pin, { scryptHash, sha256Hash } = {}) {
  const value = String(pin ?? '');
  if (!value) return false;

  let scryptConfig = String(scryptHash || process.env.ADMIN_PIN_SCRYPT || '').trim();
  if (scryptConfig.startsWith('ADMIN_PIN_SCRYPT=')) {
    scryptConfig = scryptConfig.substring('ADMIN_PIN_SCRYPT='.length).trim();
  }
  if ((scryptConfig.startsWith('"') && scryptConfig.endsWith('"')) || (scryptConfig.startsWith("'") && scryptConfig.endsWith("'"))) {
    scryptConfig = scryptConfig.slice(1, -1).trim();
  }
  if (scryptConfig.startsWith('scrypt$')) {
    const [, saltHex, hashHex] = scryptConfig.split('$');
    if (!saltHex || !hashHex) return false;
    try {
      const expected = Buffer.from(hashHex, 'hex');
      const actual = crypto.scryptSync(value, Buffer.from(saltHex, 'hex'), expected.length, {
        N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024
      });
      return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  const configured = sha256Hash || process.env.ADMIN_PIN_HASH || '';
  if (!configured) return false;

  // El PIN "0493" es publico (estuvo en el codigo y en el historial del repo).
  // No se acepta NUNCA, ni aunque alguien lo deje como respaldo en el entorno.
  if (isWeakConfiguredPin(configured)) return false;

  return secureCompare(hashSHA256(value), configured);
}

/** Hash conocido del PIN "0493": si coincide, avisa de que hay que cambiarlo. */
export const KNOWN_WEAK_PIN_HASH = '5eb11bf58cb9eb8ad63d3dcac1e264ecda98bd97d56b4d16ea19b73d0d7584c3';
export function isWeakConfiguredPin(hash) {
  return String(hash || '') === KNOWN_WEAK_PIN_HASH;
}

// ------------------------------------------------------------------------------
// Tokens de sesión de administrador (HMAC-SHA256 firmado, 12 h)
// ------------------------------------------------------------------------------

const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

let cachedPasswordVersion = 1;
let passwordVersionGetter = null;

export function setCachedPasswordVersion(version) {
  const num = Number(version);
  if (Number.isFinite(num) && num >= 1) {
    cachedPasswordVersion = num;
  }
}

export function getCachedPasswordVersion() {
  return cachedPasswordVersion;
}

export function setPasswordVersionGetter(fn) {
  passwordVersionGetter = typeof fn === 'function' ? fn : null;
}

export function createAdminToken(extra = {}) {
  const secret = getAdminAuthSecret();
  if (!secret) throw new Error('ADMIN_AUTH_SECRET no configurado: no se puede emitir sesión.');
  const payload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + ADMIN_TOKEN_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex'),
    pwd: extra.pwd ?? getCachedPasswordVersion(),
    ...extra
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

const BIO_REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 días

export function createBioRefreshToken(extra = {}) {
  const secret = getAdminAuthSecret();
  if (!secret) throw new Error('ADMIN_AUTH_SECRET no configurado: no se puede emitir sesión biométrica.');
  const payload = {
    role: 'admin',
    type: 'bio_refresh',
    iat: Date.now(),
    exp: Date.now() + BIO_REFRESH_TOKEN_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex'),
    pwd: extra.pwd ?? getCachedPasswordVersion(),
    ...extra
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyBioRefreshToken(token) {
  if (!token || typeof token !== 'string') return null;
  const payload = verifyAdminToken(token);
  if (!payload || payload.type !== 'bio_refresh') return null;
  return payload;
}

export function verifyAdminToken(token, { expectedPasswordVersion } = {}) {
  const secret = getAdminAuthSecret();
  if (!secret) return null;
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!secureCompare(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload?.role !== 'admin') return null;
    if (!payload?.exp || Date.now() > payload.exp) return null;
    if (expectedPasswordVersion !== undefined && expectedPasswordVersion !== null) {
      if (payload.pwd !== expectedPasswordVersion) return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Lee el token de `Authorization: Bearer <token>` o de `x-admin-token`. */
export function readAdminToken(req) {
  const header = String(req?.headers?.authorization || '');
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  const alt = req?.headers?.['x-admin-token'];
  return typeof alt === 'string' ? alt.trim() : '';
}

/** Middleware: toda ruta protegida exige una sesión de administrador válida. */
export async function requireAdminAuth(req, res, next) {
  const token = readAdminToken(req);
  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión en el panel.' });
  }

  let activeVersion = getCachedPasswordVersion();
  if (typeof passwordVersionGetter === 'function') {
    try {
      const fetched = await passwordVersionGetter();
      if (fetched !== undefined && fetched !== null) {
        activeVersion = Number(fetched) || activeVersion;
      }
    } catch (err) {
      // Fallar cerrado: si el almacén de seguridad falla, proteger los datos
      return res.status(401).json({ error: 'Error de verificación de sesión (servicio de autenticación no disponible).' });
    }
  }

  // Si la versión del token no coincide con la versión activa, sesión revocada
  if (payload.pwd !== activeVersion) {
    return res.status(401).json({ error: 'Sesión revocada. Por favor, inicia sesión de nuevo.' });
  }

  req.admin = payload;
  return next();
}

// ------------------------------------------------------------------------------
// Tokens de recibo público (para no exponer el CRM completo al mostrar un recibo)
// ------------------------------------------------------------------------------

const RECEIPT_TOKEN_BYTES = 12;

export function createReceiptToken(bookingId) {
  const secret = getAdminAuthSecret();
  if (!secret) return '';
  const signature = crypto
    .createHmac('sha256', `${secret}:receipt`)
    .update(String(bookingId))
    .digest('base64url')
    .slice(0, RECEIPT_TOKEN_BYTES * 2);
  return `${Buffer.from(String(bookingId)).toString('base64url')}.${signature}`;
}

export function verifyReceiptToken(token) {
  const secret = getAdminAuthSecret();
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;

  const [encodedId, signature] = token.split('.');
  if (!encodedId || !signature) return null;

  let bookingId;
  try {
    bookingId = Buffer.from(encodedId, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expected = crypto
    .createHmac('sha256', `${secret}:receipt`)
    .update(bookingId)
    .digest('base64url')
    .slice(0, RECEIPT_TOKEN_BYTES * 2);

  return secureCompare(signature, expected) ? bookingId : null;
}

// ------------------------------------------------------------------------------
// Escapado de HTML para plantillas de correo e impresión de recibos
// ------------------------------------------------------------------------------

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Campos públicos de una reserva (nunca expone notas internas ni banderas). */
export function toPublicBooking(booking, { receiptToken, paidAmount } = {}) {
  if (!booking) return null;
  return {
    id: booking.id,
    clientName: booking.clientName || 'Cliente',
    clientWhatsApp: booking.clientWhatsApp || '',
    clientEmail: booking.clientEmail || '',
    packageName: booking.packageName || 'Sesión Fotográfica',
    totalPrice: Number(booking.totalPrice) || 0,
    locationType: booking.locationType || 'san_antero',
    specificLocation: booking.specificLocation || '',
    dateTime: booking.dateTime || '',
    status: booking.status || 'pending',
    createdAt: booking.createdAt || '',
    receiptToken: receiptToken || undefined,
    paidAmount: Number.isFinite(Number(paidAmount)) ? Number(paidAmount) : undefined
  };
}

// ------------------------------------------------------------------------------
// Enmascaramiento de PII para logs seguros (cumplimiento Ley 1581 / Habeas Data)
// ------------------------------------------------------------------------------

export function maskEmail(email) {
  const raw = String(email ?? '').trim();
  if (!raw || !raw.includes('@')) return '[sin-email]';
  const [local, domain] = raw.split('@');
  if (!local || !domain) return '[email-oculto]';
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function maskPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '[tel-oculto]';
  return `***${digits.slice(-4)}`;
}

// ------------------------------------------------------------------------------
// Tokens criptográficos para galerías privadas
// ------------------------------------------------------------------------------

export function generateGalleryToken() {
  return crypto.randomUUID();
}

export function isValidGalleryTokenFormat(token) {
  const raw = String(token ?? '').trim();
  if (!raw || raw.length < 8 || raw.length > 128) return false;
  if (raw === 'demo-cliente-2026') return true;
  return /^[a-zA-Z0-9_-]+$/.test(raw);
}

// ------------------------------------------------------------------------------
// Obtención de IP confiable (anti-spoofing de X-Forwarded-For)
// ------------------------------------------------------------------------------

export function getTrustedClientIp(req) {
  if (!req) return 'unknown';

  // 1. En Vercel Edge/Serverless, x-vercel-forwarded-for y x-real-ip son inyectados por la plataforma
  if (process.env.VERCEL === '1') {
    const vercelIp = String(req.headers?.['x-vercel-forwarded-for'] || req.headers?.['x-real-ip'] || '')
      .split(',')[0]
      .trim();
    if (vercelIp) return vercelIp;
  }

  // 2. Solo si TRUST_PROXY=true explícito se acepta el último salto añadido por el proxy reverso confiable
  if (process.env.TRUST_PROXY === 'true') {
    const xff = String(req.headers?.['x-forwarded-for'] || '');
    if (xff) {
      const hops = xff.split(',').map((s) => s.trim()).filter(Boolean);
      if (hops.length > 0) return hops[hops.length - 1];
    }
    if (req.ip) return String(req.ip).trim();
  }

  // 3. Por defecto se ignora X-Forwarded-For enviado por el cliente para impedir falsificación de IP
  const rawAddr = String(req.socket?.remoteAddress || req.ip || '127.0.0.1').trim();
  return rawAddr.replace(/^::ffff:/i, '') || '127.0.0.1';
}

// ------------------------------------------------------------------------------
// Reducción de PII para el feed de notificaciones en segundo plano (/api/apk/feed)
// ------------------------------------------------------------------------------

function extractFirstName(fullName) {
  const clean = String(fullName || 'Cliente').trim();
  if (!clean) return 'Cliente';
  return clean.split(/\s+/)[0];
}

export function toMinimalApkFeed({ bookings = [], payments = [], sessions = [], reviews = [] } = {}) {
  return {
    bookings: (Array.isArray(bookings) ? bookings : []).map((b) => ({
      id: b?.id || '',
      clientFirstName: extractFirstName(b?.clientName),
      packageName: b?.packageName || 'Sesión Fotográfica',
      dateTime: b?.dateTime || '',
      status: b?.status || 'pending',
      createdAt: b?.createdAt || ''
    })),
    payments: (Array.isArray(payments) ? payments : []).map((p) => ({
      id: p?.id || '',
      clientFirstName: extractFirstName(p?.clientName),
      amount: Number(p?.amount) || 0,
      method: p?.method || '',
      status: p?.status || 'pending',
      createdAt: p?.createdAt || ''
    })),
    sessions: (Array.isArray(sessions) ? sessions : []).map((s) => ({
      id: s?.id || '',
      clientFirstName: extractFirstName(s?.clientName),
      packageTitle: s?.packageTitle || '',
      status: s?.status || 'active',
      selectedCount: Number(s?.selectedCount) || (Array.isArray(s?.photos) ? s.photos.filter((p) => p?.selected).length : 0),
      createdAt: s?.createdAt || ''
    })),
    reviews: (Array.isArray(reviews) ? reviews : []).map((r) => ({
      id: r?.id || '',
      clientFirstName: extractFirstName(r?.clientName),
      rating: Number(r?.rating) || 5,
      createdAt: r?.createdAt || ''
    }))
  };
}

// ------------------------------------------------------------------------------
// Tokens de dispositivo APK con scope restringido (solo lectura de feed reducido)
// y revocación individual por deviceId (nunca equivalen a sesión de administrador)
// ------------------------------------------------------------------------------

const APK_DEVICE_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 días

export function createApkDeviceToken({ deviceId, deviceName = 'APK Android', pwd } = {}) {
  const secret = getAdminAuthSecret();
  if (!secret) throw new Error('ADMIN_AUTH_SECRET no configurado: no se puede emitir token de dispositivo APK.');
  const cleanDeviceId = String(deviceId || crypto.randomUUID()).trim();
  const payload = {
    role: 'apk_device',
    scope: 'apk_feed:read',
    deviceId: cleanDeviceId,
    deviceName: String(deviceName || 'APK Android').trim().slice(0, 64),
    iat: Date.now(),
    exp: Date.now() + APK_DEVICE_TOKEN_TTL_MS,
    nonce: crypto.randomBytes(12).toString('hex'),
    pwd: pwd ?? getCachedPasswordVersion()
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', `${secret}:apk_device`).update(body).digest('base64url');
  return {
    token: `${body}.${signature}`,
    deviceId: cleanDeviceId,
    deviceName: payload.deviceName,
    expiresAt: new Date(payload.exp).toISOString()
  };
}

export function verifyApkDeviceToken(token, { expectedPasswordVersion, revokedDeviceIds = [] } = {}) {
  const secret = getAdminAuthSecret();
  if (!secret) return null;
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = crypto.createHmac('sha256', `${secret}:apk_device`).update(body).digest('base64url');
  if (!secureCompare(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload?.role !== 'apk_device' || payload?.scope !== 'apk_feed:read') return null;
    if (!payload?.deviceId || !payload?.exp || Date.now() > payload.exp) return null;
    if (expectedPasswordVersion !== undefined && expectedPasswordVersion !== null) {
      if (payload.pwd !== expectedPasswordVersion) return null;
    }
    const revokedSet = new Set(Array.isArray(revokedDeviceIds) ? revokedDeviceIds : []);
    if (revokedSet.has(payload.deviceId)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------------------
// Bitácora estructurada de auditoría financiera y de seguridad
// ------------------------------------------------------------------------------

const MAX_IN_MEMORY_AUDIT_LOGS = 500;

export async function recordFinancialAuditLog(
  { action, actor = 'system', entityType = 'system', entityId = '', amount = null, ip = '', details = {} } = {},
  { runtimeDB, isMongoConfigured, upsertMongoDoc } = {}
) {
  const entry = {
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    action: String(action || 'UNKNOWN_ACTION'),
    actor: String(actor || 'system'),
    entityType: String(entityType || 'system'),
    entityId: String(entityId || ''),
    amount: amount !== null && amount !== undefined ? Number(amount) : null,
    ip: String(ip || ''),
    details: details && typeof details === 'object' ? details : {}
  };

  if (runtimeDB && typeof runtimeDB === 'object') {
    if (!Array.isArray(runtimeDB.auditLogs)) runtimeDB.auditLogs = [];
    runtimeDB.auditLogs.unshift(entry);
    if (runtimeDB.auditLogs.length > MAX_IN_MEMORY_AUDIT_LOGS) {
      runtimeDB.auditLogs.length = MAX_IN_MEMORY_AUDIT_LOGS;
    }
  }

  if (typeof isMongoConfigured === 'function' && isMongoConfigured() && typeof upsertMongoDoc === 'function') {
    try {
      await upsertMongoDoc('audit_logs', { id: entry.id }, entry);
    } catch (e) {
      console.warn('⚠️ [AuditLog] Error persistiendo evento en MongoDB:', e?.message || e);
    }
  }

  return entry;
}



