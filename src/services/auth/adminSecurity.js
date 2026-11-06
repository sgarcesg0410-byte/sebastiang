// ==============================================================================
// MÓDULO DE SEGURIDAD ADMINISTRATIVA (CLIENTE)
// ==============================================================================
// La autenticación real, verificación scrypt y firma HMAC-SHA256 residen
// exclusivamente en el backend (api/security.js). Este módulo solo mantiene
// utilidades locales de control de intentos (UI) y lectura de sesión de pestaña.
// ==============================================================================

const LOCAL_PIN_HASH_KEY = 'sebastian_g_admin_pin_hash_v2';
const LOCAL_ATTEMPTS_KEY = 'sebastian_g_admin_login_attempts_v1';
const LOCAL_SESSION_KEY = 'sebastian_g_admin_server_session_v1';

// Sin PIN por defecto en cliente: prohibido incluir hashes de contraseñas reales o débiles
export const DEFAULT_PIN_HASH = '';

// Configuración de bloqueo anti-brute-force en UI (respaldado por rate-limit distribuido en servidor)
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutos de bloqueo

function getSecureRandomHex(byteLength = 16) {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    if (typeof globalThis.crypto.randomUUID === 'function' && byteLength === 16) {
      return globalThis.crypto.randomUUID().replace(/-/g, '');
    }
    if (typeof globalThis.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(byteLength);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
  }
  throw new Error('CSPRNG (Web Crypto API) no disponible en este entorno.');
}

/**
 * Hash SHA-256 usando Web Crypto API
 */
export async function hashStringSHA256(str) {
  const clean = String(str || '').trim();
  if (!clean) return '';

  const cryptoObj = (typeof window !== 'undefined' && window.crypto) || (typeof globalThis !== 'undefined' && globalThis.crypto);
  if (cryptoObj && cryptoObj.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(clean);
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return '';
}

/**
 * Comparación de strings en tiempo constante (anti-timing-attack)
 */
export function secureCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Obtiene el estado actual de intentos de login en la interfaz
 */
export function getAttemptsState() {
  try {
    const raw = localStorage.getItem(LOCAL_ATTEMPTS_KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw);
    if (parsed.lockedUntil && Date.now() > parsed.lockedUntil) {
      localStorage.removeItem(LOCAL_ATTEMPTS_KEY);
      return { count: 0, lockedUntil: 0 };
    }
    if (parsed.windowStart && Date.now() - parsed.windowStart > LOCKOUT_WINDOW_MS) {
      localStorage.removeItem(LOCAL_ATTEMPTS_KEY);
      return { count: 0, lockedUntil: 0 };
    }
    return parsed;
  } catch (e) {
    return { count: 0, lockedUntil: 0 };
  }
}

/**
 * Registra un intento fallido de login en la interfaz
 */
export function recordFailedAttempt() {
  try {
    const state = getAttemptsState();
    const now = Date.now();
    const newState = {
      count: state.count + 1,
      windowStart: state.windowStart || now,
      lockedUntil: 0
    };

    if (newState.count >= MAX_ATTEMPTS) {
      newState.lockedUntil = now + LOCKOUT_DURATION_MS;
      newState.count = 0;
      newState.windowStart = 0;
    }

    localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify(newState));
    return newState;
  } catch (e) {
    return { count: 0, lockedUntil: 0 };
  }
}

/**
 * Resetea los intentos tras login exitoso
 */
export function resetAttempts() {
  try {
    localStorage.removeItem(LOCAL_ATTEMPTS_KEY);
  } catch (e) {}
}

/**
 * Verifica si el usuario está bloqueado temporalmente en la interfaz
 */
export function checkLockout() {
  const state = getAttemptsState();
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    return {
      locked: true,
      remainingMs: state.lockedUntil - Date.now(),
      remainingMinutes: Math.ceil((state.lockedUntil - Date.now()) / 60000)
    };
  }
  return { locked: false, remainingMs: 0, remainingMinutes: 0 };
}

/**
 * Obsoleto: el cliente nunca almacena ni consulta hashes de PIN reales.
 */
export function getActivePinHash() {
  return '';
}

export function savePinHash() {
  try {
    localStorage.removeItem(LOCAL_PIN_HASH_KEY);
  } catch (e) {}
}

/**
 * Genera un token de sesión local estructurado con CSPRNG (sin Math.random).
 * Nota: la autorización de endpoints administrativos exige siempre el token HMAC del servidor.
 */
export function generateSessionToken() {
  const payload = {
    role: 'admin',
    type: 'admin_access',
    iat: Date.now(),
    exp: Date.now() + 12 * 60 * 60 * 1000, // 12 horas
    nonce: getSecureRandomHex(16)
  };
  const body = btoa(JSON.stringify(payload));
  const localTag = getSecureRandomHex(16);
  const token = `${body}.${localTag}`;
  try {
    sessionStorage.setItem(LOCAL_SESSION_KEY, token);
  } catch (e) {}
  return token;
}

/**
 * Valida la estructura y vigencia temporal de un token emitido por el servidor (`body.signature`).
 * Nota: la verificación criptográfica HMAC-SHA256 la ejecuta siempre el servidor en `requireAdminAuth`.
 */
export function validateSessionToken(token) {
  try {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      return { valid: false, reason: 'invalid' };
    }
    const [body, signature] = token.split('.');
    if (!body || !signature) {
      return { valid: false, reason: 'invalid' };
    }
    const normalized = body.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized));
    if (decoded?.role !== 'admin' || (decoded?.type && decoded.type !== 'admin_access')) {
      return { valid: false, reason: 'invalid_type' };
    }
    if (!decoded.exp || Date.now() > decoded.exp) {
      try {
        sessionStorage.removeItem(LOCAL_SESSION_KEY);
      } catch (e) {}
      return { valid: false, reason: 'expired' };
    }
    return { valid: true, payload: decoded };
  } catch (e) {
    return { valid: false, reason: 'invalid' };
  }
}

/**
 * Obtiene la sesión activa desde `sessionStorage` si su token firmado aún no ha expirado
 */
export function getActiveSession() {
  try {
    const raw = sessionStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const result = validateSessionToken(raw);
    if (result.valid) return result.payload;
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Limpia la sesión activa (logout)
 */
export function clearSession() {
  try {
    sessionStorage.removeItem(LOCAL_SESSION_KEY);
    localStorage.removeItem(LOCAL_SESSION_KEY);
    localStorage.removeItem(LOCAL_ATTEMPTS_KEY);
  } catch (e) {}
}
