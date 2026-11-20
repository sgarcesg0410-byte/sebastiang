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
import {
  hashSHA256,
  secureCompare,
  setCachedPasswordVersion,
  getCachedPasswordVersion,
  getTrustedClientIp,
  hashPinScryptAsync,
  recordFinancialAuditLog,
  isForbiddenWeakPassword
} from './security.js';
import { sendPasswordResetCodeEmail, sendPasswordChangedAlertEmail } from './emailService.js';
import {
  isMongoConfigured,
  getMongoUri,
  upsertMongoDoc,
  updateMongoDoc,
  findMongoDocs,
  findMongoDoc,
  checkDistributedRateLimit,
  claimOneShotEmergencyToken
} from './db/mongo.js';

// Caché de corta duración (15 s) para passwordVersion indexado por URI de MongoDB,
// invalidado inmediatamente tras cada cambio/reseteo de contraseña (Hallazgo ARCH-07).
const PASSWORD_VERSION_CACHE_TTL_MS = 15 * 1000;
let passwordVersionStoreCache = { version: null, fetchedAt: 0, mongoUri: '' };

export function invalidatePasswordVersionCache() {
  passwordVersionStoreCache = { version: null, fetchedAt: 0, mongoUri: '' };
}

// Rate limiters en memoria por IP (respaldados en MongoDB Atlas cuando está configurado - Hallazgo A2)
const resetRequestAttempts = new Map(); // ip -> { count, windowStart }
const resetConfirmAttempts = new Map(); // ip -> { count, windowStart }
const emergencyResetAttempts = new Map(); // ip -> { count, resetAt }
const MAX_RATE_LIMIT_MAP_SIZE = 2000;

function pruneMapIfOversized(map) {
  if (map.size <= MAX_RATE_LIMIT_MAP_SIZE) return;
  while (map.size > MAX_RATE_LIMIT_MAP_SIZE) {
    const oldestKey = map.keys().next().value;
    if (!oldestKey) break;
    map.delete(oldestKey);
  }
}

/**
 * Espera la entrega SMTP de forma acotada (máx. 4s) antes de cerrar la respuesta HTTP
 * para evitar que Vercel congele el lambda antes de enviar el correo, pero sin causar 504 si Zoho tarda.
 */
async function awaitEmailBounded(promise, maxWaitMs = 4000, contextLabel = 'correo') {
  let timer = null;
  const safePromise = Promise.resolve(promise).catch(err => {
    console.error(`[Seguridad] Error enviando ${contextLabel}:`, err?.message || err);
    return false;
  });
  const timeoutPromise = new Promise(resolve => {
    timer = setTimeout(() => resolve('timeout'), maxWaitMs);
    if (typeof timer.unref === 'function') timer.unref();
  });
  try {
    await Promise.race([safePromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const RESET_REQUEST_MAX = 3;
const RESET_REQUEST_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

const RESET_CONFIRM_MAX = 5;
const RESET_CONFIRM_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

const EMERGENCY_RESET_MAX = 3;
const EMERGENCY_RESET_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function checkEmergencyResetRateLimit(ip) {
  pruneMapIfOversized(emergencyResetAttempts);
  const now = Date.now();
  const entry = emergencyResetAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    emergencyResetAttempts.set(ip, { count: 1, resetAt: now + EMERGENCY_RESET_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= EMERGENCY_RESET_MAX) {
    const retryAfterMs = Math.max(0, entry.resetAt - now);
    return {
      allowed: false,
      retryAfterMin: Math.max(1, Math.ceil(retryAfterMs / 60000)),
      retryAfterMs
    };
  }
  entry.count += 1;
  return { allowed: true };
}

export function getClientIp(req) {
  return getTrustedClientIp(req);
}

/**
 * Lee el correo administrativo exclusivamente desde la variable de entorno ADMIN_EMAIL,
 * sin correos personales en texto plano dentro del código fuente (Hallazgo B5).
 */
export function getAdminEmail() {
  return String(process.env.ADMIN_EMAIL || '').trim();
}

/** Rate limiter para solicitud de código */
export function checkResetRequestRateLimit(ip) {
  pruneMapIfOversized(resetRequestAttempts);
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
  pruneMapIfOversized(resetConfirmAttempts);
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
  emergencyResetAttempts.clear();
}

/**
 * Guarda el challenge de reseteo en MongoDB Atlas y memoria (fuente única de verdad)
 */
export async function saveResetChallenge({ runtimeDB, challenge }) {
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (!isMongoConfigured() && isProduction) {
    throw new Error('Persistencia duradera requerida en producción para emitir códigos de seguridad.');
  }

  if (isMongoConfigured()) {
    const ok = await upsertMongoDoc('security', {
      $or: [{ id: 'admin_reset_challenge' }, { key: 'admin_reset_challenge' }]
    }, {
      id: 'admin_reset_challenge',
      key: 'admin_reset_challenge',
      ...challenge,
      savedAt: new Date().toISOString()
    }, { throwOnError: true });
    if (!ok) {
      throw new Error('Fallo al persistir challenge en MongoDB Atlas');
    }
  }

  if (runtimeDB) {
    runtimeDB.settings = runtimeDB.settings || {};
    runtimeDB.settings.adminResetChallenge = challenge;
  }
}

/**
 * Lee el challenge de reseteo activo desde MongoDB Atlas o memoria
 */
export async function getResetChallenge({ runtimeDB }) {
  if (isMongoConfigured()) {
    try {
      const docs = await findMongoDocs('security', {
        $or: [{ id: 'admin_reset_challenge' }, { key: 'admin_reset_challenge' }]
      });
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
 * Guarda la nueva clave y passwordVersion en MongoDB Atlas y memoria de forma duradera
 */
export async function updateAdminPasswordInStore({ runtimeDB, newScryptHash, newVersion }) {
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (!isMongoConfigured() && isProduction) {
    throw new Error('Persistencia duradera requerida en producción para cambiar la contraseña administrativa.');
  }

  if (isMongoConfigured()) {
    const ok = await upsertMongoDoc('security', {
      $or: [{ id: 'system_admin_pin_hash' }, { key: 'admin_pin_hash' }]
    }, {
      id: 'system_admin_pin_hash',
      key: 'admin_pin_hash',
      scryptHash: newScryptHash,
      passwordVersion: newVersion,
      updatedAt: new Date().toISOString()
    }, { throwOnError: true });
    if (!ok) throw new Error('Fallo al persistir nueva clave en MongoDB Atlas');
  }

  if (runtimeDB) {
    runtimeDB.settings = runtimeDB.settings || {};
    runtimeDB.settings.adminPinScrypt = newScryptHash;
    runtimeDB.settings.adminPasswordVersion = newVersion;
  }
  setCachedPasswordVersion(newVersion);
  invalidatePasswordVersionCache();
}

/**
 * Obtiene la versión actual de la contraseña (por defecto 1),
 * usando caché acotada de 15 s por URI de MongoDB e invalidación inmediata al rotar clave.
 */
export async function getActivePasswordVersionFromStore({ runtimeDB, forceRefresh = false } = {}) {
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (isMongoConfigured()) {
    const currentUri = getMongoUri();
    const now = Date.now();
    if (
      !forceRefresh &&
      passwordVersionStoreCache.version !== null &&
      passwordVersionStoreCache.mongoUri === currentUri &&
      (now - passwordVersionStoreCache.fetchedAt) < PASSWORD_VERSION_CACHE_TTL_MS
    ) {
      return passwordVersionStoreCache.version;
    }
    try {
      const docs = await findMongoDocs(
        'security',
        { $or: [{ id: 'system_admin_pin_hash' }, { key: 'admin_pin_hash' }] },
        null,
        0,
        { throwOnError: isProduction, projection: { passwordVersion: 1, _id: 0 } }
      );
      if (docs && docs[0]?.passwordVersion) {
        const v = Number(docs[0].passwordVersion);
        if (Number.isFinite(v) && v >= 1) {
          setCachedPasswordVersion(v);
          passwordVersionStoreCache = { version: v, fetchedAt: now, mongoUri: currentUri };
          return v;
        }
      }
      const fallbackVer = Number(runtimeDB?.settings?.adminPasswordVersion) || getCachedPasswordVersion();
      passwordVersionStoreCache = { version: fallbackVer, fetchedAt: now, mongoUri: currentUri };
      return fallbackVer;
    } catch (e) {
      invalidatePasswordVersionCache();
      if (isProduction) {
        throw new Error(`Almacén de versión de contraseña en MongoDB Atlas no disponible: ${e?.message || e}`);
      }
    }
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
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (!isMongoConfigured() && isProduction) {
    return res.status(503).json({
      error: 'Recuperación de contraseña temporalmente no disponible (persistencia requerida).'
    });
  }

  const ip = getClientIp(req);
  const rate = checkResetRequestRateLimit(ip);

  if (!rate.allowed) {
    return res.status(429).json({
      error: `Demasiadas solicitudes de recuperación. Intenta de nuevo en ${rate.retryAfterMin} minutos.`,
      retryAfterMs: rate.retryAfterMs
    });
  }

  if (isMongoConfigured()) {
    const distRate = await checkDistributedRateLimit({
      key: `pw_reset_req_${ip}`,
      maxAttempts: RESET_REQUEST_MAX,
      windowMs: RESET_REQUEST_WINDOW_MS,
      failClosed: isProduction
    });
    if (!distRate.allowed) {
      const retryAfterMs = distRate.retryAfterMs || RESET_REQUEST_WINDOW_MS;
      return res.status(429).json({
        error: `Demasiadas solicitudes de recuperación. Intenta de nuevo en ${Math.max(1, Math.ceil(retryAfterMs / 60000))} minutos.`,
        retryAfterMs
      });
    }
  }

  // REGLA 1: Email 100% en el servidor. Ignora completamente req.body.email.
  const targetEmail = getAdminEmail();

  // REGLA 2: Código de 6 dígitos efímero y seguro con crypto.randomInt (NUNCA Math.random) y salting criptográfico (Hallazgo #36)
  const codeInt = crypto.randomInt(100000, 1000000);
  const code = String(codeInt);
  const salt = crypto.randomBytes(16).toString('hex');
  const codeHash = hashSHA256(`${code}:${salt}`);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos
  const challenge = {
    codeHash,
    salt,
    expiresAt,
    used: false,
    attempts: 0,
    requestedAt: new Date().toISOString()
  };

  try {
    await saveResetChallenge({ runtimeDB, challenge });
  } catch (err) {
    console.error('❌ [PasswordReset] Fallo al guardar challenge duradero:', err?.message || err);
    return res.status(503).json({
      error: 'Error interno asegurando el código de recuperación. Intenta más tarde.'
    });
  }

  // REGLA 4: Fuga cero: enviar por correo sin loguear el código (espera acotada máx. 4s para fiabilidad en Vercel sin 504)
  await awaitEmailBounded(emailSender(code, targetEmail), 4000, 'correo de reseteo');

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
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (!isMongoConfigured() && isProduction) {
    return res.status(503).json({
      error: 'Recuperación de contraseña temporalmente no disponible (persistencia requerida).'
    });
  }

  const ip = getClientIp(req);
  const rate = checkResetConfirmRateLimit(ip);

  if (!rate.allowed) {
    return res.status(429).json({
      error: `Demasiados intentos de verificación. Intenta en ${rate.retryAfterMin} minutos.`,
      retryAfterMs: rate.retryAfterMs
    });
  }

  if (isMongoConfigured()) {
    const distRate = await checkDistributedRateLimit({
      key: `pw_reset_confirm_${ip}`,
      maxAttempts: RESET_CONFIRM_MAX,
      windowMs: RESET_CONFIRM_WINDOW_MS,
      failClosed: isProduction
    });
    if (!distRate.allowed) {
      const retryAfterMs = distRate.retryAfterMs || RESET_CONFIRM_WINDOW_MS;
      return res.status(429).json({
        error: `Demasiados intentos de verificación. Intenta en ${Math.max(1, Math.ceil(retryAfterMs / 60000))} minutos.`,
        retryAfterMs
      });
    }
  }

  const { code, newPassword } = req.body || {};

  // Caso 6: Validación previa de longitud y fortaleza mínima de contraseña (mínimo 8 caracteres)
  // Se rechaza SIN consumir ni incrementar intentos del código
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    return res.status(400).json({
      error: 'La nueva contraseña debe tener al menos 8 caracteres.'
    });
  }
  if (isForbiddenWeakPassword(newPassword)) {
    return res.status(400).json({
      error: 'La contraseña elegida es demasiado común o repetitiva. Usa una clave más segura.'
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
    try { await saveResetChallenge({ runtimeDB, challenge }); } catch (e) {}
    return res.status(400).json({ error: 'Código inválido o expirado.' });
  }

  // 2. Intentos agotados previamente
  if ((challenge.attempts || 0) >= 5) {
    challenge.used = true;
    try { await saveResetChallenge({ runtimeDB, challenge }); } catch (e) {}
    return res.status(400).json({ error: 'Código inválido o expirado.' });
  }

  // 3. Verificación en tiempo constante (crypto.timingSafeEqual / secureCompare con salt)
  const expectedHash = challenge.salt
    ? hashSHA256(`${cleanCode}:${challenge.salt}`)
    : hashSHA256(cleanCode);
  const isMatch = secureCompare(expectedHash, challenge.codeHash);

  if (!isMatch) {
    challenge.attempts = (challenge.attempts || 0) + 1;
    if (challenge.attempts >= 5) {
      // Bloqueo estricto del código: se quema de por vida
      challenge.used = true;
    }
    try { await saveResetChallenge({ runtimeDB, challenge }); } catch (e) {}
    return res.status(400).json({ error: 'Código inválido o expirado.' });
  }

  // ÉXITO: Código válido. Proceder todo-o-nada:
  // 1. Quemar el código de forma atómica para evitar carreras entre múltiples instancias concurrentes
  if (isMongoConfigured()) {
    try {
      const burnRes = await updateMongoDoc('security', {
        $or: [{ id: 'admin_reset_challenge' }, { key: 'admin_reset_challenge' }],
        used: false,
        codeHash: challenge.codeHash
      }, {
        $set: {
          used: true,
          consumedAt: new Date().toISOString(),
          consumedIp: ip
        }
      }, { throwOnError: true });

      if (!burnRes || (burnRes.matchedCount === 0 && burnRes.modifiedCount === 0)) {
        return res.status(400).json({ error: 'Código inválido o ya utilizado.' });
      }
    } catch (eMongo) {
      console.error('❌ [PasswordReset] Fallo consumiendo código en MongoDB Atlas:', eMongo?.message || eMongo);
      return res.status(500).json({ error: 'Fallo al procesar el código de recuperación en la base de datos central.' });
    }
  }

  if (challenge.used) {
    return res.status(400).json({ error: 'Código inválido o ya utilizado.' });
  }
  challenge.used = true;
  if (runtimeDB?.settings) {
    runtimeDB.settings.adminResetChallenge = challenge;
  }

  // 2. Derivar hash scrypt bancario de la nueva contraseña de forma asíncrona (Hallazgo B2)
  const cleanNew = newPassword.trim();
  const newScryptHash = await hashPinScryptAsync(cleanNew);

  // 3. Incrementar passwordVersion para revocar TODAS las sesiones activas
  const currentVersion = await getActivePasswordVersionFromStore({ runtimeDB });
  const newVersion = (currentVersion || 1) + 1;

  try {
    await updateAdminPasswordInStore({ runtimeDB, newScryptHash, newVersion });
  } catch (eStore) {
    console.error('❌ [PasswordReset] Fallo actualizando contraseña en store:', eStore?.message || eStore);
    return res.status(500).json({ error: 'Error persistiendo nueva contraseña en la base de datos central.' });
  }

  // 4. Enviar alerta de seguridad por correo vía Zoho a ADMIN_EMAIL (espera acotada máx. 3s)
  const targetEmail = getAdminEmail();
  await awaitEmailBounded(alertSender(targetEmail, { ip }), 3000, 'alerta de cambio de contraseña');

  return res.json({
    success: true,
    message: '✓ Contraseña restablecida con éxito. Inicia sesión con tu nueva contraseña.'
  });
}

/**
 * Endpoint 3: POST /api/admin/password/emergency-reset
 * Reseteo break-glass de un solo uso mediante ADMIN_EMERGENCY_RESET_TOKEN cuando Zoho SMTP está caído.
 */
export async function handleEmergencyPasswordReset(req, res, { runtimeDB } = {}) {
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (!isMongoConfigured() && isProduction) {
    return res.status(503).json({
      error: 'Reseteo de emergencia temporalmente no disponible (persistencia requerida en producción).'
    });
  }

  const ip = getClientIp(req);

  // 1. Rate limiting (3 intentos / 15 min / IP)
  const rate = checkEmergencyResetRateLimit(ip);
  if (!rate.allowed) {
    return res.status(429).json({
      error: `Demasiados intentos de reseteo de emergencia. Intenta en ${rate.retryAfterMin} minutos.`,
      retryAfterMs: rate.retryAfterMs
    });
  }

  if (isMongoConfigured()) {
    const distRate = await checkDistributedRateLimit({
      key: `pw_emergency_reset_${ip}`,
      maxAttempts: EMERGENCY_RESET_MAX,
      windowMs: EMERGENCY_RESET_WINDOW_MS,
      failClosed: isProduction
    });
    if (!distRate.allowed) {
      const retryAfterMs = distRate.retryAfterMs || EMERGENCY_RESET_WINDOW_MS;
      return res.status(429).json({
        error: `Demasiados intentos de reseteo de emergencia. Intenta en ${Math.max(1, Math.ceil(retryAfterMs / 60000))} minutos.`,
        retryAfterMs
      });
    }
  }

  // 2. Token de emergencia configurado en el entorno
  const configuredEmergencyToken = (process.env.ADMIN_EMERGENCY_RESET_TOKEN || '').trim();
  if (!configuredEmergencyToken || configuredEmergencyToken.length < 32) {
    return res.status(503).json({
      error: 'Reseteo de emergencia no configurado o token inválido en el servidor.'
    });
  }

  const { token, newPassword } = req.body || {};

  // 3. Validación de nueva contraseña (mínimo 8 caracteres y no débil)
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    return res.status(400).json({
      error: 'La nueva contraseña debe tener al menos 8 caracteres.'
    });
  }
  if (isForbiddenWeakPassword(newPassword)) {
    return res.status(400).json({
      error: 'La contraseña elegida es demasiado común o repetitiva. Usa una clave más segura.'
    });
  }

  const cleanToken = String(token || '').trim();
  if (!cleanToken) {
    return res.status(400).json({ error: 'Token de emergencia requerido.' });
  }

  // 4. Verificación en tiempo constante (timing-safe)
  const isMatch = secureCompare(cleanToken, configuredEmergencyToken);
  if (!isMatch) {
    return res.status(401).json({ error: 'Token de emergencia inválido.' });
  }

  // 5 & 6. Protección One-Shot Atómica (sin TOCTOU): verificar y quemar en una sola operación condicional
  const tokenHash = hashSHA256(configuredEmergencyToken);
  if (runtimeDB?.settings?.usedEmergencyTokens?.includes(tokenHash)) {
    return res.status(400).json({
      error: 'Este token de emergencia ya fue utilizado. Genera uno nuevo con scripts/generate-emergency-token.mjs y actualízalo en Vercel.'
    });
  }

  if (isMongoConfigured()) {
    try {
      const claimResult = await claimOneShotEmergencyToken({
        docId: `emergency_token_${tokenHash}`,
        tokenHash,
        usedByIp: ip
      });
      if (claimResult.dbUnavailable && isProduction) {
        return res.status(503).json({ error: 'Base de datos central no disponible para validar el token de emergencia.' });
      }
      if (!claimResult.dbUnavailable && !claimResult.claimed) {
        return res.status(400).json({
          error: 'Este token de emergencia ya fue utilizado. Genera uno nuevo con scripts/generate-emergency-token.mjs y actualízalo en Vercel.'
        });
      }
    } catch (eMongo) {
      if (isProduction) {
        return res.status(500).json({ error: 'Error al reclamar atómicamente el token de emergencia en MongoDB Atlas.' });
      }
    }
  }

  if (runtimeDB) {
    runtimeDB.settings = runtimeDB.settings || {};
    runtimeDB.settings.usedEmergencyTokens = runtimeDB.settings.usedEmergencyTokens || [];
    runtimeDB.settings.usedEmergencyTokens.push(tokenHash);
  }

  // 7. Derivar hash scrypt bancario asíncrono
  const cleanNew = newPassword.trim();
  const newScryptHash = await hashPinScryptAsync(cleanNew);

  // 8. Incrementar passwordVersion para revocar todas las sesiones previas
  const currentVersion = await getActivePasswordVersionFromStore({ runtimeDB });
  const newVersion = (currentVersion || 1) + 1;

  try {
    await updateAdminPasswordInStore({ runtimeDB, newScryptHash, newVersion });
  } catch (eStore) {
    console.error('❌ [PasswordReset] Fallo actualizando contraseña en store:', eStore?.message || eStore);
    return res.status(500).json({ error: 'Error persistiendo nueva contraseña en la base de datos central.' });
  }

  // 9. Registrar en audit_log con action: 'admin_password_emergency_reset'
  try {
    await recordFinancialAuditLog({
      action: 'admin_password_emergency_reset',
      actor: 'emergency_token',
      entityType: 'admin_auth',
      entityId: 'admin_pin',
      ip,
      status: 'success',
      details: { note: 'Password reset via emergency break-glass token' }
    }, { runtimeDB, isMongoConfigured, upsertMongoDoc });
  } catch (eLog) {
    console.warn('[AuditLog] No se pudo registrar evento de auditoría:', eLog?.message || eLog);
  }

  return res.json({
    success: true,
    message: '✓ Contraseña restablecida con éxito mediante token de emergencia. Todas las sesiones previas han sido revocadas. Recuerda generar un nuevo token en Vercel para futuras emergencias.'
  });
}
