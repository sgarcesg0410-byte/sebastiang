// ==============================================================================
// RECUPERACIÓN SEGURA DE CONTRASEÑA DE ADMINISTRADOR (ZOHO SMTP)
// ==============================================================================
// Cumple estrictamente las 5 reglas y 3 invariantes de seguridad:
// 1. Email de destino 100% en el servidor (ignora req.body.email).
// 2. Código de 6 dígitos efímero (hash SHA-256 en MongoDB Atlas, 10 min, secureCompare).
// 3. Anti-fuerza bruta: máx 3 req/15 min IP y quema tras 5 intentos fallidos.
// 4. Fuga cero: código nunca en respuestas HTTP ni en logs.
// 5. Invalidación global de sesiones (passwordVersion).
// 6. Alerta de seguridad por correo tras cambio de contraseña.
// ==============================================================================

import crypto from 'crypto';
import { hashSHA256, secureCompare, setCachedPasswordVersion, getCachedPasswordVersion, getTrustedClientIp } from './security.js';
import { sendPasswordResetCodeEmail, sendPasswordChangedAlertEmail } from './emailService.js';
import { isMongoConfigured, upsertMongoDoc, findMongoDocs } from './db/mongo.js';

// Rate limiters en memoria por IP
const resetRequestAttempts = new Map(); // ip -> { count, windowStart }
const resetConfirmAttempts = new Map(); // ip -> { count, windowStart }

const RESET_REQUEST_MAX = 3;
const RESET_REQUEST_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

const RESET_CONFIRM_MAX = 5;
const RESET_CONFIRM_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

export function getClientIp(req) {
  return getTrustedClientIp(req);
}

export function getAdminEmail() {
  return (process.env.ADMIN_EMAIL || 'sgarcesg0410@gmail.com').trim();
}

/** Rate limiter para solicitud de código */
export function checkResetRequestRateLimit(ip) {
  const now = Date.now();
  const record = resetRequestAttempts.get(ip) || { count: 0, windowStart: now };

  if (now - record.windowStart > RESET_REQUEST_WINDOW_MS) {
    record.count = 0;
    record.windowStart = now;
  }

  if (record.count >= RESET_REQUEST_MAX) {
    const retryAfterMs = record.windowStart + RESET_REQUEST_WINDOW_MS - now;
    return {
      allowed: false,
      retryAfterMs,
      retryAfterMin: Math.ceil(retryAfterMs / 60000)
    };
  }

  record.count += 1;
  resetRequestAttempts.set(ip, record);
  return { allowed: true };
}

/** Rate limiter para confirmación de reseteo */
export function checkResetConfirmRateLimit(ip) {
  const now = Date.now();
  const record = resetConfirmAttempts.get(ip) || { count: 0, windowStart: now };

  if (now - record.windowStart > RESET_CONFIRM_WINDOW_MS) {
    record.count = 0;
    record.windowStart = now;
  }

  if (record.count >= RESET_CONFIRM_MAX) {
    const retryAfterMs = record.windowStart + RESET_CONFIRM_WINDOW_MS - now;
    return {
      allowed: false,
      retryAfterMs,
      retryAfterMin: Math.ceil(retryAfterMs / 60000)
    };
  }

  record.count += 1;
  resetConfirmAttempts.set(ip, record);
  return { allowed: true };
}

/** Limpia rate limiters (útil para pruebas) */
export function clearRateLimiters() {
  resetRequestAttempts.clear();
  resetConfirmAttempts.clear();
}

/**
 * Guarda el challenge de reseteo en MongoDB Atlas y memoria (fuente única de verdad)
 */
export async function saveResetChallenge({ runtimeDB, challenge }) {
  if (runtimeDB) {
    runtimeDB.settings = runtimeDB.settings || {};
    runtimeDB.settings.adminResetChallenge = challenge;
  }

  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('security', { key: 'admin_reset_challenge' }, {
        key: 'admin_reset_challenge',
        ...challenge,
        savedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[MongoDB] Advertencia guardando challenge:', e?.message || e);
    }
  }
}

/**
 * Lee el challenge de reseteo activo desde MongoDB Atlas o memoria
 */
export async function getResetChallenge({ runtimeDB }) {
  if (isMongoConfigured()) {
    try {
      const docs = await findMongoDocs('security', { key: 'admin_reset_challenge' });
      if (docs && docs[0] && docs[0].codeHash) {
        return docs[0];
      }
    } catch (e) {
      console.warn('[MongoDB] Advertencia leyendo challenge:', e?.message || e);
    }
  }

  return runtimeDB?.settings?.adminResetChallenge || null;
}

/**
 * Guarda la nueva clave y passwordVersion en MongoDB Atlas y memoria
 */
export async function updateAdminPasswordInStore({ runtimeDB, newScryptHash, newVersion }) {
  if (runtimeDB) {
    runtimeDB.settings = runtimeDB.settings || {};
    runtimeDB.settings.adminPinScrypt = newScryptHash;
    runtimeDB.settings.adminPasswordVersion = newVersion;
  }
  setCachedPasswordVersion(newVersion);

  if (isMongoConfigured()) {
    try {
      await upsertMongoDoc('security', { key: 'admin_pin_hash' }, {
        key: 'admin_pin_hash',
        scryptHash: newScryptHash,
        passwordVersion: newVersion,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[MongoDB] Advertencia actualizando contraseña:', e?.message || e);
    }
  }
}

/**
 * Obtiene la versión actual de la contraseña (por defecto 1)
 */
export async function getActivePasswordVersionFromStore({ runtimeDB }) {
  if (isMongoConfigured()) {
    try {
      const docs = await findMongoDocs('security', { key: 'admin_pin_hash' });
      if (docs && docs[0]?.passwordVersion) {
        const v = Number(docs[0].passwordVersion);
        if (Number.isFinite(v) && v >= 1) {
          setCachedPasswordVersion(v);
          return v;
        }
      }
    } catch (e) {}
  }

  const inMem = runtimeDB?.settings?.adminPasswordVersion;
  if (inMem && Number.isFinite(Number(inMem))) {
    return Number(inMem);
  }

  return getCachedPasswordVersion();
}

/**
 * Endpoint 1: POST /api/admin/password/reset-request
 */
export async function handlePasswordResetRequest(req, res, { runtimeDB, emailSender = sendPasswordResetCodeEmail } = {}) {
  const ip = getClientIp(req);
  const rate = checkResetRequestRateLimit(ip);

  if (!rate.allowed) {
    return res.status(429).json({
      error: `Demasiadas solicitudes de recuperación. Intenta de nuevo en ${rate.retryAfterMin} minutos.`,
      retryAfterMs: rate.retryAfterMs
    });
  }

  // REGLA 1: Email 100% en el servidor. Ignora completamente req.body.email.
  const targetEmail = getAdminEmail();

  // REGLA 2: Código de 6 dígitos efímero y seguro con crypto.randomInt (NUNCA Math.random)
  const codeInt = crypto.randomInt(100000, 1000000);
  const code = String(codeInt);
  const codeHash = hashSHA256(code);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos
  const challenge = {
    codeHash,
    expiresAt,
    used: false,
    attempts: 0,
    requestedAt: new Date().toISOString()
  };

  await saveResetChallenge({ runtimeDB, challenge });

  // REGLA 4: Fuga cero: enviar por correo sin loguear el código
  try {
    await emailSender(code, targetEmail);
  } catch (err) {
    console.error('[Seguridad] Error enviando correo de reseteo:', err?.message || err);
  }

  // Respuesta genérica estricta (sin código, sin revelar correo)
  return res.json({
    success: true,
    message: 'Si el correo corresponde al administrador, se envió un código.'
  });
}

/**
 * Endpoint 2: POST /api/admin/password/reset-confirm
 */
export async function handlePasswordResetConfirm(req, res, {
  runtimeDB,
  alertSender = sendPasswordChangedAlertEmail
} = {}) {
  const ip = getClientIp(req);
  const rate = checkResetConfirmRateLimit(ip);

  if (!rate.allowed) {
    return res.status(429).json({
      error: `Demasiados intentos de verificación. Intenta en ${rate.retryAfterMin} minutos.`,
      retryAfterMs: rate.retryAfterMs
    });
  }

  const { code, newPassword } = req.body || {};

  // Caso 6: Validación previa de longitud de contraseña (mínimo 8 caracteres)
  // Se rechaza SIN consumir ni incrementar intentos del código
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    return res.status(400).json({
      error: 'La nueva contraseña debe tener al menos 8 caracteres.'
    });
  }

  const cleanCode = String(code || '').trim();
  if (!cleanCode) {
    return res.status(400).json({ error: 'Código inválido o expirado.' });
  }

  const challenge = await getResetChallenge({ runtimeDB });
  if (!challenge || challenge.used === true) {
    return res.status(400).json({ error: 'Código inválido o expirado.' });
  }

  // 1. Expiración
  const expiresTimestamp = new Date(challenge.expiresAt).getTime();
  if (Number.isNaN(expiresTimestamp) || Date.now() > expiresTimestamp) {
    challenge.used = true;
    await saveResetChallenge({ runtimeDB, challenge });
    return res.status(400).json({ error: 'Código inválido o expirado.' });
  }

  // 2. Intentos agotados previamente
  if ((challenge.attempts || 0) >= 5) {
    challenge.used = true;
    await saveResetChallenge({ runtimeDB, challenge });
    return res.status(400).json({ error: 'Código inválido o expirado.' });
  }

  // 3. Verificación en tiempo constante (crypto.timingSafeEqual / secureCompare)
  const isMatch = secureCompare(hashSHA256(cleanCode), challenge.codeHash);

  if (!isMatch) {
    challenge.attempts = (challenge.attempts || 0) + 1;
    if (challenge.attempts >= 5) {
      // Bloqueo estricto del código: se quema de por vida
      challenge.used = true;
    }
    await saveResetChallenge({ runtimeDB, challenge });
    return res.status(400).json({ error: 'Código inválido o expirado.' });
  }

  // ÉXITO: Código válido. Proceder todo-o-nada:
  // 1. Quemar el código de inmediato (un solo uso)
  challenge.used = true;
  await saveResetChallenge({ runtimeDB, challenge });

  // 2. Derivar hash scrypt bancario de la nueva contraseña
  const cleanNew = newPassword.trim();
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(cleanNew, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const newScryptHash = 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');

  // 3. Incrementar passwordVersion para revocar TODAS las sesiones activas
  const currentVersion = await getActivePasswordVersionFromStore({ runtimeDB });
  const newVersion = (currentVersion || 1) + 1;

  await updateAdminPasswordInStore({ runtimeDB, newScryptHash, newVersion });

  // 4. Enviar alerta de seguridad por correo vía Zoho a ADMIN_EMAIL
  const targetEmail = getAdminEmail();
  try {
    await alertSender(targetEmail, { ip });
  } catch (err) {
    console.error('[Seguridad] Error enviando alerta de cambio de contraseña:', err?.message || err);
  }

  return res.json({
    success: true,
    message: '✓ Contraseña restablecida con éxito. Inicia sesión con tu nueva contraseña.'
  });
}
