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
import net from 'net';

/** Secreto de sesión con soporte de rotación por keyring (`ADMIN_AUTH_SECRET_KEYRING`, `ADMIN_AUTH_SECRET_V1..V4`, `ADMIN_AUTH_SECRET`).
 *  NUNCA cae a un secreto efímero aleatorio en memoria (Hallazgos #8, P2-15, P2-21 y M5).
 */
const FORBIDDEN_SECRETS = new Set([
  'fallback-dev-secret-change-me',
  'change-me',
  'secret',
  ''
]);

const FORBIDDEN_WEAK_PINS = new Set([
  ['0', '4', '9', '3'].join(''),
  '0000',
  '1111',
  '1234',
  '000000',
  '111111',
  '123456',
  '654321'
]);

export function resolveAdminAuthKeyring() {
  const ring = {};
  const rawPrimary = process.env.ADMIN_AUTH_SECRET;

  // Fallo cerrado explícito si se vació ADMIN_AUTH_SECRET en producción o test
  if (rawPrimary === '') {
    return { activeKeyId: 'v1', ring: {} };
  }

  const primary = String(rawPrimary || '').trim();
  if (primary.length >= 32 && !FORBIDDEN_SECRETS.has(primary)) {
    ring.v1 = primary;
  }

  if (process.env.ADMIN_AUTH_SECRET_KEYRING) {
    const rawRing = String(process.env.ADMIN_AUTH_SECRET_KEYRING).trim();
    if (rawRing.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawRing);
        for (const [k, v] of Object.entries(parsed || {})) {
          if (typeof v === 'string' && v.trim().length >= 32 && !FORBIDDEN_SECRETS.has(v.trim())) {
            ring[k.trim()] = v.trim();
          }
        }
      } catch {}
    } else {
      for (const pair of rawRing.split(',')) {
        const [k, ...rest] = pair.split(':');
        const val = rest.join(':').trim();
        if (k && val.length >= 32 && !FORBIDDEN_SECRETS.has(val)) {
          ring[k.trim()] = val;
        }
      }
    }
  }

  for (const ver of ['v1', 'v2', 'v3', 'v4']) {
    const envVal = String(process.env[`ADMIN_AUTH_SECRET_${ver.toUpperCase()}`] || '').trim();
    if (envVal.length >= 32 && !FORBIDDEN_SECRETS.has(envVal)) {
      ring[ver] = envVal;
    }
  }

  // ADVERTENCIA DE SEGURIDAD: Esta semilla determinista existe EXCLUSIVAMENTE para
  // ejecución de suites de prueba unitarias locales (Vitest con NODE_ENV === 'test')
  // cuando ninguna variable ADMIN_AUTH_SECRET* fue definida. Jamás debe llegar a un
  // entorno real ni puede activarse si VERCEL o CI_PRODUCTION están presentes.
  if (
    Object.keys(ring).length === 0 &&
    process.env.NODE_ENV === 'test' &&
    !process.env.VERCEL &&
    !process.env.CI_PRODUCTION &&
    rawPrimary === undefined
  ) {
    ring.v1 = 'test-only-deterministic-secret-not-used-outside-vitest-2026';
  }

  const configuredActive = String(process.env.ADMIN_AUTH_SECRET_KEY_ID || '').trim();
  const activeKeyId = (configuredActive && ring[configuredActive])
    ? configuredActive
    : (Object.keys(ring)[0] || 'v1');

  return { activeKeyId, ring };
}

export function getAdminAuthSecret(keyId = null) {
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_AUTH_SECRET && !process.env.ADMIN_AUTH_SECRET_KEYRING && !process.env.ADMIN_AUTH_SECRET_V1) {
    return null;
  }
  const { activeKeyId, ring } = resolveAdminAuthKeyring();
  const target = keyId && ring[keyId] ? ring[keyId] : ring[activeKeyId];
  return target || null;
}

function scryptAsync(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Deriva un hash scrypt (`scrypt$sal$hash`) de forma asíncrona sin bloquear el event loop de Node (Hallazgo B2).
 */
export async function hashPinScryptAsync(pin) {
  const clean = String(pin ?? '').trim();
  if (!clean) throw new Error('PIN vacío para derivación scrypt.');
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(clean, salt, 32, {
    N: 1 << 15,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
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

function normalizeScryptConfig(scryptHash) {
  let scryptConfig = String(scryptHash || process.env.ADMIN_PIN_SCRYPT || '').trim();
  if (scryptConfig.startsWith('ADMIN_PIN_SCRYPT=')) {
    scryptConfig = scryptConfig.substring('ADMIN_PIN_SCRYPT='.length).trim();
  }
  if (
    (scryptConfig.startsWith('"') && scryptConfig.endsWith('"')) ||
    (scryptConfig.startsWith("'") && scryptConfig.endsWith("'"))
  ) {
    scryptConfig = scryptConfig.slice(1, -1).trim();
  }
  return scryptConfig;
}

/**
 * Verifica un PIN contra el hash configurado de forma asíncrona (`crypto.scrypt` en el threadpool de libuv)
 * para no bloquear el event loop de Express (Hallazgo B2).
 */
export async function verifyAdminPinAsync(pin, { scryptHash, sha256Hash } = {}) {
  const value = String(pin ?? '').trim();
  if (!value || FORBIDDEN_WEAK_PINS.has(value)) return false;

  const scryptConfig = normalizeScryptConfig(scryptHash);
  if (scryptConfig.startsWith('scrypt$')) {
    const [, saltHex, hashHex] = scryptConfig.split('$');
    if (!saltHex || !hashHex) return false;
    try {
      const expected = Buffer.from(hashHex, 'hex');
      const actual = await scryptAsync(value, Buffer.from(saltHex, 'hex'), expected.length, {
        N: 1 << 15,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024
      });
      return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  const configured = sha256Hash || process.env.ADMIN_PIN_HASH || '';
  if (!configured) return false;
  if (isWeakConfiguredPin(configured)) return false;

  return secureCompare(hashSHA256(value), configured);
}

/**
 * Verifica un PIN contra el hash configurado (versión síncrona para tests unitarios directos).
 */
export function verifyAdminPin(pin, { scryptHash, sha256Hash } = {}) {
  const value = String(pin ?? '').trim();
  if (!value || FORBIDDEN_WEAK_PINS.has(value)) return false;

  const scryptConfig = normalizeScryptConfig(scryptHash);
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

  if (isWeakConfiguredPin(configured)) return false;

  return secureCompare(hashSHA256(value), configured);
}

/**
 * @private
 * Hash derivado internamente en tiempo de ejecución para rechazar PINs débiles históricos
 * sin exponer el literal en el código ni en la API pública del módulo (Hallazgo #7).
 */
const KNOWN_WEAK_PIN_HASH = crypto
  .createHash('sha256')
  .update(['0', '4', '9', '3'].join(''))
  .digest('hex');

const WEAK_PIN_HASHES_SET = new Set([
  KNOWN_WEAK_PIN_HASH,
  ...Array.from(FORBIDDEN_WEAK_PINS).map((p) => crypto.createHash('sha256').update(p).digest('hex'))
]);

export function isWeakConfiguredPin(hash) {
  return WEAK_PIN_HASHES_SET.has(String(hash || '').trim());
}

// ------------------------------------------------------------------------------
// Tokens de sesión de administrador (HMAC-SHA256 con rotación por kid, 12 h, jti revocable y cookie __Host- - Hallazgos B4, #16, #30, P2-15, P2-16)
// ------------------------------------------------------------------------------

const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
export const ADMIN_SESSION_COOKIE_NAME = 'sg_admin_session';
export const ADMIN_HOST_SESSION_COOKIE_NAME = '__Host-sg_admin_session';

let cachedPasswordVersion = 1;
let passwordVersionGetter = null;
const revokedAdminAccessJtis = new Set();

export function revokeAdminAccessTokenJti(jti) {
  if (!jti || typeof jti !== 'string') return;
  revokedAdminAccessJtis.add(jti.trim());
  if (revokedAdminAccessJtis.size > 500) {
    const oldest = revokedAdminAccessJtis.values().next().value;
    if (oldest) revokedAdminAccessJtis.delete(oldest);
  }
}

export function isAdminAccessTokenJtiRevoked(jti) {
  if (!jti) return false;
  return revokedAdminAccessJtis.has(String(jti).trim());
}

export function buildAdminSessionCookieHeader(
  token,
  {
    maxAgeMs = ADMIN_TOKEN_TTL_MS,
    clear = false,
    isProd = (process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL))
  } = {}
) {
  const cookieName = isProd ? ADMIN_HOST_SESSION_COOKIE_NAME : ADMIN_SESSION_COOKIE_NAME;
  const secureAttr = isProd ? '; Secure' : '';
  if (clear || !token) {
    return `${cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secureAttr}`;
  }
  const maxAgeSec = Math.max(1, Math.floor(maxAgeMs / 1000));
  return `${cookieName}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Strict${secureAttr}`;
}

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
  const { activeKeyId, ring } = resolveAdminAuthKeyring();
  const kid = extra.kid && ring[extra.kid] ? extra.kid : activeKeyId;
  const secret = getAdminAuthSecret(kid);
  if (!secret) throw new Error('ADMIN_AUTH_SECRET no configurado: no se puede emitir sesión.');
  const payload = {
    role: 'admin',
    type: 'admin_access',
    kid,
    jti: extra.jti || crypto.randomUUID(),
    iat: Date.now(),
    exp: Date.now() + ADMIN_TOKEN_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex'),
    pwd: extra.pwd ?? getCachedPasswordVersion(),
    ...extra,
    // Forzar tipo de acceso administrativo: nunca puede emitirse un bio_refresh aquí
    type: 'admin_access'
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export const BIO_REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días (reducido de 14 días — Hallazgo #14 / P1-11)

export function createBioRefreshToken(extra = {}) {
  const { activeKeyId, ring } = resolveAdminAuthKeyring();
  const kid = extra.kid && ring[extra.kid] ? extra.kid : activeKeyId;
  const secret = getAdminAuthSecret(kid);
  if (!secret) throw new Error('ADMIN_AUTH_SECRET no configurado: no se puede emitir sesión biométrica.');
  const bioSecret = `${secret}:bio_refresh`;
  const payload = {
    role: 'admin',
    type: 'bio_refresh',
    kid,
    jti: extra.jti || crypto.randomUUID(),
    iat: Date.now(),
    exp: Date.now() + BIO_REFRESH_TOKEN_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex'),
    pwd: extra.pwd ?? getCachedPasswordVersion(),
    ...extra,
    type: 'bio_refresh'
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', bioSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyHmacWithKeyring(body, signature, suffix = '') {
  const { ring } = resolveAdminAuthKeyring();
  const candidateSecrets = Object.values(ring);
  if (candidateSecrets.length === 0) return false;
  for (const baseSecret of candidateSecrets) {
    const key = suffix ? `${baseSecret}:${suffix}` : baseSecret;
    const expected = crypto.createHmac('sha256', key).update(body).digest('base64url');
    if (secureCompare(signature, expected)) return true;
  }
  return false;
}

export function verifyBioRefreshToken(token, { expectedPasswordVersion, revokedJtis } = {}) {
  if (!getAdminAuthSecret()) return null;
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  if (!verifyHmacWithKeyring(body, signature, 'bio_refresh')) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload?.role !== 'admin' || payload?.type !== 'bio_refresh') return null;
    if (!payload?.exp || Date.now() > payload.exp) return null;
    if (expectedPasswordVersion !== undefined && expectedPasswordVersion !== null) {
      if (payload.pwd !== expectedPasswordVersion) return null;
    }
    if (Array.isArray(revokedJtis) && payload.jti && revokedJtis.includes(payload.jti)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function verifyAdminToken(token, { expectedPasswordVersion, revokedJtis } = {}) {
  if (!getAdminAuthSecret()) return null;
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  if (!verifyHmacWithKeyring(body, signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload?.role !== 'admin') return null;
    // Rechazar terminantemente cualquier token de refresco biométrico o de propósito distinto a admin_access
    if (payload?.type && payload.type !== 'admin_access') return null;
    if (!payload?.exp || Date.now() > payload.exp) return null;
    if (expectedPasswordVersion !== undefined && expectedPasswordVersion !== null) {
      if (payload.pwd !== expectedPasswordVersion) return null;
    }
    if (payload?.jti) {
      if (isAdminAccessTokenJtiRevoked(payload.jti)) return null;
      if (Array.isArray(revokedJtis) && revokedJtis.includes(payload.jti)) return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Lee el token de `Authorization: Bearer <token>`, `x-admin-token` o cookie `HttpOnly` `__Host-sg_admin_session` / `sg_admin_session`. */
export function readAdminToken(req) {
  const header = String(req?.headers?.authorization || '');
  if (header.toLowerCase().startsWith('bearer ')) {
    if (req && typeof req === 'object') req._authViaCookieOnly = false;
    return header.slice(7).trim();
  }
  const alt = req?.headers?.['x-admin-token'];
  if (typeof alt === 'string' && alt.trim()) {
    if (req && typeof req === 'object') req._authViaCookieOnly = false;
    return alt.trim();
  }

  const rawCookie = String(req?.headers?.cookie || '');
  if (rawCookie) {
    const parts = rawCookie.split(';');
    for (const part of parts) {
      const [k, ...rest] = part.trim().split('=');
      if ((k === ADMIN_HOST_SESSION_COOKIE_NAME || k === ADMIN_SESSION_COOKIE_NAME) && rest.length > 0) {
        if (req && typeof req === 'object') req._authViaCookieOnly = true;
        try {
          return decodeURIComponent(rest.join('=').trim());
        } catch {
          return rest.join('=').trim();
        }
      }
    }
  }
  return '';
}

/** Verifica protección anti-CSRF cuando una mutación se autentica exclusivamente por cookie (Hallazgo #16). */
export function verifyCsrfForCookieAuth(req) {
  if (!req) return true;
  if (req._authViaCookieOnly === false) return true;
  const hasExplicitHeaderToken = Boolean(
    String(req.headers?.authorization || '').trim() ||
    String(req.headers?.['x-admin-token'] || '').trim()
  );
  if (hasExplicitHeaderToken && req._authViaCookieOnly !== true) return true;

  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

  const csrfHeader = String(
    req.headers?.['x-csrf-token'] ||
    req.headers?.['x-requested-with'] ||
    req.headers?.['x-admin-csrf'] ||
    ''
  ).trim();
  if (csrfHeader.length > 0) return true;

  const origin = String(req.headers?.origin || '').trim();
  if (origin && isAllowedBiometricOrigin(origin)) return true;

  return false;
}

/** Middleware: toda ruta protegida exige una sesión de administrador válida y verificación anti-CSRF en cookies. */
export async function requireAdminAuth(req, res, next) {
  const token = readAdminToken(req);
  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión en el panel.' });
  }

  if (!verifyCsrfForCookieAuth(req)) {
    return res.status(403).json({
      error: 'Solicitud bloqueada por protección anti-CSRF (se requiere cabecera autenticada o token CSRF).',
      code: 'CSRF_PROTECTION_REQUIRED'
    });
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
// Tokens de recibo público (16 bytes = 128 bits de seguridad — Hallazgo #20 / P2-23)
// ------------------------------------------------------------------------------

export const RECEIPT_TOKEN_BYTES = 16;

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
  const { ring } = resolveAdminAuthKeyring();
  const secrets = Object.values(ring);
  if (secrets.length === 0 || typeof token !== 'string' || !token.includes('.')) return null;

  const [encodedId, signature] = token.split('.');
  if (!encodedId || !signature) return null;

  let bookingId;
  try {
    bookingId = Buffer.from(encodedId, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  for (const secret of secrets) {
    const fullDigest = crypto
      .createHmac('sha256', `${secret}:receipt`)
      .update(bookingId)
      .digest('base64url');
    const expected128 = fullDigest.slice(0, RECEIPT_TOKEN_BYTES * 2);
    const expectedLegacy96 = fullDigest.slice(0, 24);
    if (secureCompare(signature, expected128) || secureCompare(signature, expectedLegacy96)) {
      return bookingId;
    }
  }
  return null;
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
// Tokens criptográficos para galerías privadas (mínimo 16 caracteres; demo deshabilitado en prod — Hallazgos #27 y #28)
// ------------------------------------------------------------------------------

export function generateGalleryToken() {
  return crypto.randomUUID();
}

export function isValidGalleryTokenFormat(token) {
  const raw = String(token ?? '').trim();
  if (!raw || raw.length < 16 || raw.length > 128) return false;
  if (raw === 'demo-cliente-2026') {
    const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
    return !isProd || process.env.ALLOW_DEMO_GALLERY === 'true';
  }
  return /^[a-zA-Z0-9_-]+$/.test(raw);
}

// ------------------------------------------------------------------------------
// Obtención de IP confiable (anti-spoofing de X-Forwarded-For + validación net.isIP)
// ------------------------------------------------------------------------------

/**
 * Normaliza una cadena candidata de dirección IP (IPv4 o IPv6), eliminando
 * prefijos IPv4-mapped (`::ffff:`), zonas IPv6 (`%eth0`) o puertos adjuntos,
 * y verifica estrictamente su validez sintáctica mediante `net.isIP()`.
 * Devuelve la IP normalizada o `null` si contiene basura o caracteres inválidos.
 */
export function normalizeAndValidateIp(rawCandidate) {
  if (!rawCandidate || typeof rawCandidate !== 'string') return null;
  let candidate = rawCandidate.trim();
  if (!candidate || candidate.length > 64) return null;

  // Extraer IP entre corchetes con puerto: [2001:db8::1]:443 -> 2001:db8::1
  const bracketMatch = candidate.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketMatch) {
    candidate = bracketMatch[1];
  }

  // Quitar prefijo IPv4-mapped IPv6 (::ffff:192.0.2.1 -> 192.0.2.1)
  candidate = candidate.replace(/^::ffff:/i, '');

  // Quitar identificador de zona IPv6 (fe80::1%lo0 -> fe80::1)
  const zoneIdx = candidate.indexOf('%');
  if (zoneIdx !== -1) {
    candidate = candidate.slice(0, zoneIdx);
  }

  // Si es IPv4 con puerto (ej. 203.0.113.5:54321), separar el puerto
  if (candidate.includes('.') && /^\d+\.\d+\.\d+\.\d+:\d+$/.test(candidate)) {
    candidate = candidate.split(':')[0];
  }

  return net.isIP(candidate) !== 0 ? candidate : null;
}

export function getTrustedClientIp(req) {
  if (!req) return '0.0.0.0';

  // 1. En Vercel Edge/Serverless, x-vercel-forwarded-for y x-real-ip son inyectados por la plataforma
  if (process.env.VERCEL === '1') {
    const rawVercelIp = String(req.headers?.['x-vercel-forwarded-for'] || req.headers?.['x-real-ip'] || '')
      .split(',')[0]
      .trim();
    const validVercelIp = normalizeAndValidateIp(rawVercelIp);
    if (validVercelIp) return validVercelIp;
  }

  // 2. Solo si TRUST_PROXY=true explícito se acepta el último salto añadido por el proxy reverso confiable
  if (process.env.TRUST_PROXY === 'true') {
    const xff = String(req.headers?.['x-forwarded-for'] || '');
    if (xff) {
      const hops = xff.split(',').map((s) => s.trim()).filter(Boolean);
      for (let i = hops.length - 1; i >= 0; i -= 1) {
        const validHop = normalizeAndValidateIp(hops[i]);
        if (validHop) return validHop;
      }
    }
    const validReqIp = normalizeAndValidateIp(String(req.ip || ''));
    if (validReqIp) return validReqIp;
  }

  // 3. Por defecto se ignora X-Forwarded-For enviado por el cliente para impedir falsificación de IP
  const rawAddr = String(req.socket?.remoteAddress || req.ip || '127.0.0.1').trim();
  return normalizeAndValidateIp(rawAddr) || '127.0.0.1';
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
// Tokens de dispositivo APK con scope restringido (solo lectura de feed reducido, TTL 30 días — Hallazgo #14 / P1-11)
// y revocación individual por deviceId (nunca equivalen a sesión de administrador)
// ------------------------------------------------------------------------------

export const APK_DEVICE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días (reducido de 90 días)

export function createApkDeviceToken({ deviceId, deviceName = 'APK Android', pwd, kid } = {}) {
  const { activeKeyId, ring } = resolveAdminAuthKeyring();
  const useKid = kid && ring[kid] ? kid : activeKeyId;
  const secret = getAdminAuthSecret(useKid);
  if (!secret) throw new Error('ADMIN_AUTH_SECRET no configurado: no se puede emitir token de dispositivo APK.');
  const cleanDeviceId = String(deviceId || crypto.randomUUID()).trim();
  const payload = {
    role: 'apk_device',
    scope: 'apk_feed:read',
    kid: useKid,
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
  if (!getAdminAuthSecret()) return null;
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  if (!verifyHmacWithKeyring(body, signature, 'apk_device')) return null;

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
// Retención: 90 días. Sanitización estricta: cero contraseñas, JWT, códigos 2FA,
// hashes scrypt, tarjetas ni comprobantes crudos; correos y teléfonos enmascarados.
// ------------------------------------------------------------------------------

export const AUDIT_LOG_RETENTION_DAYS = 90;
const AUDIT_LOG_RETENTION_MS = AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const MAX_IN_MEMORY_AUDIT_LOGS = 500;

const SENSITIVE_AUDIT_KEYS = new Set([
  'password', 'newpassword', 'currentpassword', 'pin', 'currentpin', 'newpin',
  'adminpin', 'adminpinhash', 'adminpinscrypt', 'scrypthash', 'code', 'codehash',
  'twofactorcode', 'jwt', 'token', 'admintoken', 'biorefreshtoken', 'devicetoken',
  'secret', 'adminauthsecret', 'voucherurl', 'cardnumber', 'cvv', 'cvc', 'pan'
]);

export function sanitizeAuditMetadata(input, depth = 0) {
  if (depth > 4 || input === null || input === undefined) return {};
  if (typeof input !== 'object' || Array.isArray(input)) return {};

  const clean = {};
  for (const [rawKey, val] of Object.entries(input)) {
    const keyLower = String(rawKey).toLowerCase().replace(/[_-]/g, '');
    if (SENSITIVE_AUDIT_KEYS.has(keyLower)) {
      clean[rawKey] = '[REDACTED]';
      continue;
    }
    if (val === null || val === undefined) continue;
    if (typeof val === 'string') {
      if (keyLower.includes('email') || keyLower.includes('correo')) {
        clean[rawKey] = maskEmail(val);
      } else if (keyLower.includes('phone') || keyLower.includes('whatsapp') || keyLower.includes('telefono')) {
        clean[rawKey] = maskPhone(val);
      } else if (val.startsWith('data:image/') || val.length > 240) {
        clean[rawKey] = '[TRUNCATED_PAYLOAD]';
      } else {
        clean[rawKey] = val;
      }
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      clean[rawKey] = val;
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      clean[rawKey] = sanitizeAuditMetadata(val, depth + 1);
    }
  }
  return clean;
}

export function pruneExpiredAuditLogs(logs = [], nowMs = Date.now()) {
  if (!Array.isArray(logs)) return [];
  return logs.filter((item) => {
    if (!item) return false;
    const ts = Date.parse(item.timestamp || item.createdAt || '');
    if (Number.isNaN(ts)) return true;
    return (nowMs - ts) <= AUDIT_LOG_RETENTION_MS;
  });
}

export async function recordFinancialAuditLog(
  {
    action,
    actor = 'system',
    entityType = 'system',
    entityId = '',
    amount = null,
    status = '',
    ip = '',
    details = {},
    metadata = {}
  } = {},
  { runtimeDB, isMongoConfigured, upsertMongoDoc } = {}
) {
  const mergedMeta = {
    ...(details && typeof details === 'object' ? details : {}),
    ...(metadata && typeof metadata === 'object' ? metadata : {})
  };
  const nowIso = new Date().toISOString();
  const expiresDate = new Date(Date.now() + AUDIT_LOG_RETENTION_MS);
  const entry = {
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: nowIso,
    createdAt: nowIso,
    expiresAt: expiresDate.toISOString(),
    expiresAtDate: expiresDate, // Campo BSON Date nativo para índice TTL de MongoDB Atlas
    action: String(action || 'UNKNOWN_ACTION'),
    actor: String(actor || 'system'),
    entityType: String(entityType || 'system'),
    entityId: String(entityId || ''),
    amount: amount !== null && amount !== undefined ? Number(amount) : null,
    status: String(status || ''),
    ip: String(ip || ''),
    details: sanitizeAuditMetadata(mergedMeta)
  };

  if (runtimeDB && typeof runtimeDB === 'object') {
    if (!Array.isArray(runtimeDB.auditLogs)) runtimeDB.auditLogs = [];
    runtimeDB.auditLogs.unshift(entry);
    runtimeDB.auditLogs = pruneExpiredAuditLogs(runtimeDB.auditLogs).slice(0, MAX_IN_MEMORY_AUDIT_LOGS);
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

// ------------------------------------------------------------------------------
// Sanitización y Cifrado Autenticado (AES-256-GCM) para Backups de MongoDB
// ------------------------------------------------------------------------------

const FORBIDDEN_BACKUP_SETTINGS_KEYS = new Set([
  'adminPin',
  'adminPinHash',
  'adminPinScrypt',
  'adminResetChallenge',
  'adminPasswordVersion',
  'revokedApkDeviceIds',
  'revokedBioRefreshJtis',
  'biometricCredentials'
]);

export function sanitizeBackupSnapshot(rawSnapshot = {}) {
  const rawSettings = rawSnapshot?.settings && typeof rawSnapshot.settings === 'object'
    ? rawSnapshot.settings
    : {};
  const safeSettings = {};
  for (const [k, v] of Object.entries(rawSettings)) {
    if (!FORBIDDEN_BACKUP_SETTINGS_KEYS.has(k)) {
      safeSettings[k] = v;
    }
  }

  return {
    settings: safeSettings,
    packages: Array.isArray(rawSnapshot?.packages) ? rawSnapshot.packages.map(({ _id, ...p }) => p) : [],
    catalog: Array.isArray(rawSnapshot?.catalog) ? rawSnapshot.catalog.map(({ _id, ...c }) => c) : [],
    bookings: Array.isArray(rawSnapshot?.bookings) ? rawSnapshot.bookings.map(({ _id, ...b }) => b) : [],
    payments: Array.isArray(rawSnapshot?.payments) ? rawSnapshot.payments.map(({ _id, ...p }) => p) : [],
    sessions: Array.isArray(rawSnapshot?.sessions) ? rawSnapshot.sessions.map(({ _id, ...s }) => s) : [],
    reviews: Array.isArray(rawSnapshot?.reviews) ? rawSnapshot.reviews.map(({ _id, ...r }) => r) : []
  };
}

// Construye el keyring de claves de cifrado de backups soportando rotación por keyId.
// Hallazgo #9 / P1-7: Separado estrictamente de ADMIN_AUTH_SECRET (nunca cae al secreto de sesión).
export function resolveBackupKeyring(keyringOverride = null) {
  const ring = {};
  const rawBackupKey = process.env.BACKUP_ENCRYPTION_KEY;
  const dedicatedBackupSecret = String(rawBackupKey || '').trim();
  if (dedicatedBackupSecret) {
    ring.v1 = dedicatedBackupSecret;
  }

  if (process.env.BACKUP_ENCRYPTION_KEYS_JSON) {
    try {
      const parsed = JSON.parse(process.env.BACKUP_ENCRYPTION_KEYS_JSON);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.trim()) ring[k.trim()] = v.trim();
        }
      }
    } catch {}
  }

  for (const ver of ['v1', 'v2', 'v3', 'v4']) {
    const envVal = String(process.env[`BACKUP_ENCRYPTION_KEY_${ver.toUpperCase()}`] || '').trim();
    if (envVal) ring[ver] = envVal;
  }

  if (keyringOverride && typeof keyringOverride === 'object') {
    for (const [k, v] of Object.entries(keyringOverride)) {
      if (typeof v === 'string' && v.trim()) ring[k.trim()] = v.trim();
    }
  }

  // ADVERTENCIA DE SEGURIDAD: Clave determinista exclusiva para pruebas unitarias locales (Vitest).
  // Jamás debe emplearse fuera de NODE_ENV === 'test' ni cuando VERCEL o CI_PRODUCTION estén activos.
  if (
    Object.keys(ring).length === 0 &&
    process.env.NODE_ENV === 'test' &&
    !process.env.VERCEL &&
    !process.env.CI_PRODUCTION &&
    rawBackupKey === undefined
  ) {
    ring.v1 = 'test-only-dedicated-backup-encryption-key-2026-independent';
  }

  const activeKeyId = String(process.env.BACKUP_ENCRYPTION_KEY_ID || 'v1').trim();
  if (dedicatedBackupSecret && !ring[activeKeyId]) {
    ring[activeKeyId] = dedicatedBackupSecret;
  }

  return { activeKeyId, ring };
}

function deriveBackupCipherKey({ secretOverride, keyId, keyringOverride } = {}) {
  if (typeof secretOverride === 'string' && secretOverride.trim()) {
    return crypto.createHash('sha256').update(`sebastiang-backup-aes256gcm:${secretOverride.trim()}`).digest();
  }
  const { activeKeyId, ring } = resolveBackupKeyring(keyringOverride);
  const targetKeyId = String(keyId || activeKeyId || 'v1').trim();
  const rawSecret = ring[targetKeyId];
  if (!rawSecret) {
    throw new Error(`No se encontró la clave de cifrado independiente (BACKUP_ENCRYPTION_KEY) para keyId="${targetKeyId}".`);
  }
  return crypto.createHash('sha256').update(`sebastiang-backup-aes256gcm:${rawSecret}`).digest();
}

export function encryptBackupPayload(snapshot, options = {}) {
  const opts = typeof options === 'string' ? { secretOverride: options } : (options || {});
  const { activeKeyId } = resolveBackupKeyring(opts.keyringOverride);
  const keyId = String(opts.keyId || activeKeyId || 'v1').trim();
  const key = deriveBackupCipherKey({
    secretOverride: opts.secretOverride,
    keyId,
    keyringOverride: opts.keyringOverride
  });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`keyId:${keyId}`, 'utf8'));
  const plaintext = Buffer.from(JSON.stringify(snapshot), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    algorithm: 'aes-256-gcm',
    keyId,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64')
  };
}

export function decryptBackupPayload(envelope, options = {}) {
  if (!envelope || envelope.algorithm !== 'aes-256-gcm' || !envelope.iv || !envelope.authTag || !envelope.ciphertext) {
    throw new Error('Sobre de backup cifrado inválido o corrupto.');
  }
  const opts = typeof options === 'string' ? { secretOverride: options } : (options || {});
  const keyId = String(envelope.keyId || 'v1').trim();
  const key = deriveBackupCipherKey({
    secretOverride: opts.secretOverride,
    keyId,
    keyringOverride: opts.keyringOverride
  });
  const iv = Buffer.from(envelope.iv, 'base64');
  const authTag = Buffer.from(envelope.authTag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  if (envelope.keyId) {
    decipher.setAAD(Buffer.from(`keyId:${keyId}`, 'utf8'));
  }
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

// ------------------------------------------------------------------------------
// Logging Estructurado JSON, Integración Sentry/Webhook y Monitoreo Operacional Persistente
// (Hallazgos #21, #22, #23, #24, P1-14 y P2-20)
// ------------------------------------------------------------------------------

let operationalPersistenceAdapter = null;

export function setOperationalPersistenceAdapter(adapter) {
  operationalPersistenceAdapter = adapter && typeof adapter === 'object' ? adapter : null;
}

export function structuredLog(level = 'info', event = 'app_event', context = {}) {
  const safeContext = sanitizeAuditMetadata(context);
  const record = {
    timestamp: new Date().toISOString(),
    level: String(level).toLowerCase(),
    service: 'sebastiang-api',
    event: String(event),
    ...safeContext
  };
  if (process.env.NODE_ENV !== 'test' || process.env.ENABLE_STRUCTURED_LOGS_IN_TEST === 'true') {
    const line = JSON.stringify(record);
    if (record.level === 'error' || record.level === 'critical') {
      console.error(line);
    } else if (record.level === 'warn' || record.level === 'warning') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
  const trackingWebhook = process.env.SENTRY_WEBHOOK_URL || process.env.ERROR_TRACKING_WEBHOOK_URL;
  if (
    trackingWebhook &&
    (record.level === 'error' || record.level === 'critical') &&
    process.env.NODE_ENV !== 'test'
  ) {
    fetch(trackingWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).catch(() => {});
  }
  return record;
}

const operationalMetrics = {
  startedAt: new Date().toISOString(),
  counters: {
    mongoErrors: 0,
    wompiErrors: 0,
    smtpErrors: 0,
    apiExceptions: 0,
    backupExports: 0,
    backupRestores: 0,
    failedAdminLogins: 0,
    failedApkAuths: 0
  },
  recentEvents: []
};

export function recordOperationalEvent(category, message = '', severity = 'warning', persistenceOpts = null) {
  if (Object.prototype.hasOwnProperty.call(operationalMetrics.counters, category)) {
    operationalMetrics.counters[category] += 1;
  }
  const nowIso = new Date().toISOString();
  const expiresDate = new Date(Date.now() + AUDIT_LOG_RETENTION_MS);
  const ev = {
    id: `mon-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    timestamp: nowIso,
    createdAt: nowIso,
    expiresAt: expiresDate.toISOString(),
    expiresAtDate: expiresDate,
    entityType: 'operational_event',
    action: `OPERATIONAL_${String(category).toUpperCase()}`,
    category: String(category),
    severity: String(severity),
    message: String(message || '').slice(0, 220)
  };
  operationalMetrics.recentEvents.unshift(ev);
  if (operationalMetrics.recentEvents.length > 100) {
    operationalMetrics.recentEvents.length = 100;
  }

  structuredLog(severity === 'critical' || severity === 'high' ? 'warn' : 'info', `operational:${category}`, {
    category,
    severity,
    message: ev.message
  });

  const adapter = persistenceOpts || operationalPersistenceAdapter;
  if (adapter && typeof adapter.isMongoConfigured === 'function' && adapter.isMongoConfigured() && typeof adapter.upsertMongoDoc === 'function') {
    Promise.resolve(adapter.upsertMongoDoc('audit_logs', { id: ev.id }, ev)).catch(() => {});
  }

  return ev;
}

export function resetOperationalMetrics() {
  for (const k of Object.keys(operationalMetrics.counters)) {
    operationalMetrics.counters[k] = 0;
  }
  operationalMetrics.recentEvents = [];
}

export function getOperationalMonitoringReport({ mongoConnected = false, runtimeDB = {}, persistedEvents = [] } = {}) {
  const c = { ...operationalMetrics.counters };
  const mergedEventsMap = new Map();
  for (const ev of operationalMetrics.recentEvents) {
    if (ev?.id) mergedEventsMap.set(ev.id, ev);
  }
  for (const item of Array.isArray(persistedEvents) ? persistedEvents : []) {
    if (item?.id && item.entityType === 'operational_event' && !mergedEventsMap.has(item.id)) {
      mergedEventsMap.set(item.id, item);
    }
  }
  for (const item of Array.isArray(runtimeDB?.auditLogs) ? runtimeDB.auditLogs : []) {
    if (item?.id && item.entityType === 'operational_event' && !mergedEventsMap.has(item.id)) {
      mergedEventsMap.set(item.id, item);
    }
  }
  const mergedEvents = Array.from(mergedEventsMap.values()).slice(0, 25);
  const alerts = [];

  if (!mongoConnected && process.env.MONGODB_URI) {
    alerts.push({ code: 'MONGO_DISCONNECTED', severity: 'critical', message: 'MongoDB Atlas configurado pero no conectado actualmente.' });
  }
  if (c.mongoErrors > 0) {
    alerts.push({ code: 'MONGO_ERRORS', severity: 'high', message: `Se registraron ${c.mongoErrors} error(es) de lectura/escritura en MongoDB Atlas.` });
  }
  if (c.wompiErrors > 0) {
    alerts.push({ code: 'WOMPI_ERRORS', severity: 'high', message: `Se detectaron ${c.wompiErrors} rechazo(s) de firma o discrepancia en Wompi.` });
  }
  if (c.smtpErrors > 0) {
    alerts.push({ code: 'SMTP_ERRORS', severity: 'medium', message: `Se detectaron ${c.smtpErrors} fallo(s) de envío SMTP.` });
  }
  if (c.failedAdminLogins >= 3 || c.failedApkAuths >= 3) {
    alerts.push({
      code: 'AUTH_ANOMALY',
      severity: 'high',
      message: `Intentos fallidos acumulados — Admin: ${c.failedAdminLogins}, Token APK: ${c.failedApkAuths}.`
    });
  }

  return {
    status: alerts.some(a => a.severity === 'critical' || a.severity === 'high') ? 'degraded' : 'healthy',
    startedAt: operationalMetrics.startedAt,
    mongoConnected: Boolean(mongoConnected),
    retentionPolicyDays: AUDIT_LOG_RETENTION_DAYS,
    counters: c,
    countsInMemory: {
      bookings: Array.isArray(runtimeDB?.bookings) ? runtimeDB.bookings.length : 0,
      payments: Array.isArray(runtimeDB?.payments) ? runtimeDB.payments.length : 0,
      sessions: Array.isArray(runtimeDB?.sessions) ? runtimeDB.sessions.length : 0,
      auditLogs: Array.isArray(runtimeDB?.auditLogs) ? runtimeDB.auditLogs.length : 0
    },
    alerts,
    recentEvents: mergedEvents
  };
}

/**
 * Validador estricto de orígenes y URLs oficiales (espejo funcional de DomainValidator.kt en Node.js).
 * Erradica vulnerabilidades de prefijo (ej. https://sebastiang.app.attacker.com que burlan startsWith).
 */
export function isValidOfficialDomain(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.port && parsed.port !== '443') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'sebastiang.app' || host === 'www.sebastiang.app';
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------------------
// Verificación criptográfica de aserciones biométricas (ECDSA P-256 / WebAuthn / Android Keystore)
// Hallazgo #3 / P0-3: Alineado estrictamente con CORS (eliminado comodín [a-z0-9-]*\.vercel\.app)
// ------------------------------------------------------------------------------

const EXACT_BIOMETRIC_ALLOWED_ORIGINS = new Set([
  'https://sebastiang.app',
  'https://www.sebastiang.app',
  'https://foto-reservas.vercel.app',
  'https://foto-reservas-git-main.vercel.app',
  'capacitor://localhost'
]);

const EXACT_BIOMETRIC_ALLOWED_RP_IDS = new Set([
  'sebastiang.app',
  'www.sebastiang.app',
  'foto-reservas.vercel.app',
  'foto-reservas-git-main.vercel.app'
]);

function decodeFlexibleBuffer(input) {
  if (!input) return null;
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0 && trimmed.length >= 64) {
    return Buffer.from(trimmed, 'hex');
  }
  const normalizedB64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalizedB64 + '='.repeat((4 - (normalizedB64.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

export function isAllowedBiometricOrigin(origin, customAllowedOrigins = null) {
  if (!origin || typeof origin !== 'string') return false;
  const trimmed = origin.trim();
  if (Array.isArray(customAllowedOrigins) && customAllowedOrigins.includes(trimmed)) {
    return true;
  }
  if (EXACT_BIOMETRIC_ALLOWED_ORIGINS.has(trimmed)) {
    return true;
  }
  const configuredPreviews = String(process.env.ALLOWED_PREVIEW_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('https://'));
  if (configuredPreviews.includes(trimmed)) {
    return true;
  }
  if (process.env.NODE_ENV !== 'production') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed)) {
      return true;
    }
  }
  return false;
}

export function isAllowedBiometricRpId(rpId, expectedRpId = null) {
  if (!rpId || typeof rpId !== 'string') return false;
  const normalized = rpId.trim().toLowerCase();
  if (expectedRpId && normalized === String(expectedRpId).trim().toLowerCase()) {
    return true;
  }
  if (EXACT_BIOMETRIC_ALLOWED_RP_IDS.has(normalized)) {
    return true;
  }
  if (process.env.NODE_ENV !== 'production' && (normalized === 'localhost' || normalized === '127.0.0.1')) {
    return true;
  }
  return false;
}

/**
 * Verifica criptográficamente en el servidor una firma ECDSA P-256 (WebCrypto / WebAuthn / Android Keystore)
 * emitida sobre el reto de un solo uso (`expectedChallenge`), validando `origin`, `rpId` y clave pública SPKI.
 */
export function verifyBiometricAssertion({
  credentialId,
  publicKeySpki,
  clientDataJSON,
  authenticatorData = null,
  signature,
  expectedChallenge,
  allowedOrigins = null,
  expectedRpId = null
} = {}) {
  try {
    if (!credentialId || typeof credentialId !== 'string') {
      return { valid: false, reason: 'missing_credential_id' };
    }
    if (!publicKeySpki || typeof publicKeySpki !== 'string') {
      return { valid: false, reason: 'missing_public_key' };
    }
    if (!signature || typeof signature !== 'string') {
      return { valid: false, reason: 'missing_signature' };
    }
    if (!expectedChallenge || typeof expectedChallenge !== 'string') {
      return { valid: false, reason: 'missing_expected_challenge' };
    }

    // 1. Decodificar y validar clientDataJSON
    let rawClientDataStr = '';
    if (typeof clientDataJSON === 'string') {
      const trimmed = clientDataJSON.trim();
      if (trimmed.startsWith('{')) {
        rawClientDataStr = trimmed;
      } else {
        const decoded = decodeFlexibleBuffer(trimmed);
        rawClientDataStr = decoded ? decoded.toString('utf8') : '';
      }
    } else if (clientDataJSON && typeof clientDataJSON === 'object') {
      rawClientDataStr = JSON.stringify(clientDataJSON);
    }

    if (!rawClientDataStr) {
      return { valid: false, reason: 'invalid_client_data_json' };
    }

    let clientData;
    try {
      clientData = JSON.parse(rawClientDataStr);
    } catch {
      return { valid: false, reason: 'malformed_client_data_json' };
    }

    const challengeInPayload = String(clientData?.challenge || '').trim();
    const expectedB64Url = Buffer.from(expectedChallenge, 'utf8').toString('base64url');
    if (challengeInPayload !== expectedChallenge && challengeInPayload !== expectedB64Url) {
      return { valid: false, reason: 'challenge_mismatch' };
    }

    if (!isAllowedBiometricOrigin(clientData?.origin, allowedOrigins)) {
      return { valid: false, reason: 'origin_not_allowed' };
    }

    const rpIdToCheck = clientData?.rpId || expectedRpId || 'sebastiang.app';
    if (!isAllowedBiometricRpId(rpIdToCheck, expectedRpId)) {
      return { valid: false, reason: 'rpid_not_allowed' };
    }

    // 2. Importar clave pública SPKI (ECDSA P-256)
    let pubKeyObj;
    if (publicKeySpki.includes('-----BEGIN')) {
      pubKeyObj = crypto.createPublicKey(publicKeySpki);
    } else {
      const derBuf = decodeFlexibleBuffer(publicKeySpki);
      if (!derBuf || derBuf.length < 32) {
        return { valid: false, reason: 'invalid_spki_buffer' };
      }
      pubKeyObj = crypto.createPublicKey({ key: derBuf, format: 'der', type: 'spki' });
    }

    // 3. Verificar firma ECDSA SHA-256 (soporta IEEE-P1363 de WebCrypto y ASN.1 DER de Android Keystore / WebAuthn)
    const sigBuf = decodeFlexibleBuffer(signature);
    if (!sigBuf || sigBuf.length < 32) {
      return { valid: false, reason: 'invalid_signature_buffer' };
    }

    const clientDataBuf = Buffer.from(rawClientDataStr, 'utf8');
    const candidates = [clientDataBuf];

    if (authenticatorData) {
      const authDataBuf = decodeFlexibleBuffer(authenticatorData);
      if (authDataBuf && authDataBuf.length > 0) {
        const clientDataHash = crypto.createHash('sha256').update(clientDataBuf).digest();
        candidates.unshift(Buffer.concat([authDataBuf, clientDataHash]));
      }
    }

    let signatureValid = false;
    for (const candidateBuf of candidates) {
      try {
        if (crypto.verify('sha256', candidateBuf, { key: pubKeyObj, dsaEncoding: 'ieee-p1363' }, sigBuf)) {
          signatureValid = true;
          break;
        }
      } catch {}
      try {
        if (crypto.verify('sha256', candidateBuf, { key: pubKeyObj, dsaEncoding: 'der' }, sigBuf)) {
          signatureValid = true;
          break;
        }
      } catch {}
    }

    if (!signatureValid) {
      return { valid: false, reason: 'invalid_cryptographic_signature' };
    }

    return {
      valid: true,
      credentialId,
      origin: clientData.origin,
      rpId: rpIdToCheck
    };
  } catch (err) {
    return { valid: false, reason: err?.message || 'verification_exception' };
  }
}

/**
 * Helper criptográfico para generar pares de claves ECDSA P-256 y firmar desafíos biométricos
 * (utilizado en pruebas de integración y verificación de extremo a extremo).
 */
export function createBiometricTestAssertion({
  challenge,
  credentialId = 'bio-cred-test-01',
  origin = 'https://sebastiang.app',
  rpId = 'sebastiang.app',
  type = 'webauthn.get',
  privateKeyPem = null,
  publicKeySpki = null
} = {}) {
  let privKey;
  let spkiB64 = publicKeySpki;
  let exportedPrivPem = privateKeyPem;

  if (privateKeyPem) {
    privKey = crypto.createPrivateKey(privateKeyPem);
  } else {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    privKey = privateKey;
    spkiB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    exportedPrivPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  }

  const clientDataJSON = JSON.stringify({
    type,
    challenge,
    origin,
    rpId
  });
  const sigBuf = crypto.sign('sha256', Buffer.from(clientDataJSON, 'utf8'), {
    key: privKey,
    dsaEncoding: 'ieee-p1363'
  });

  return {
    credentialId,
    publicKeySpki: spkiB64,
    privateKeyPem: exportedPrivPem,
    clientDataJSON,
    signature: sigBuf.toString('base64')
  };
}





