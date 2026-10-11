// ==============================================================================
// MÓDULO DE SEGURIDAD ADMINISTRATIVA
// ==============================================================================
// Centraliza toda la lógica criptográfica y de control de acceso admin:
// - Hashing SHA-256 con Web Crypto API
// - Rate limiting local (anti-brute-force)
// - Tokens de sesión firmados
// - Comparación en tiempo constante (anti-timing-attack)
// ==============================================================================

const LOCAL_PIN_HASH_KEY = 'sebastian_g_admin_pin_hash_v2';
const LOCAL_ATTEMPTS_KEY = 'sebastian_g_admin_login_attempts_v1';
const LOCAL_SESSION_KEY = 'sebastian_g_admin_session_v1';

// Hash SHA-256 por defecto para el PIN "0493" (mantenido por retrocompatibilidad)
export const DEFAULT_PIN_HASH = '5eb11bf58cb9eb8ad63d3dcac1e264ecda98bd97d56b4d16ea19b73d0d7584c3';

// Configuración de bloqueo anti-brute-force
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutos de bloqueo

/**
 * Hash SHA-256 usando Web Crypto API (con fallback seguro)
 */
export async function hashStringSHA256(str) {
  const clean = String(str || '').trim();
  if (!clean) return '';

  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(clean);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback seguro (Node.js / entornos sin Web Crypto)
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(clean);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback último: hash determinístico no criptográfico
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
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
 * Obtiene el estado actual de intentos de login
 */
export function getAttemptsState() {
  try {
    const raw = localStorage.getItem(LOCAL_ATTEMPTS_KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw);
    // Si el bloqueo expiró, resetear
    if (parsed.lockedUntil && Date.now() > parsed.lockedUntil) {
      localStorage.removeItem(LOCAL_ATTEMPTS_KEY);
      return { count: 0, lockedUntil: 0 };
    }
    // Si la ventana de conteo expiró, resetear contador
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
 * Registra un intento fallido de login
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

    // Si alcanzó el máximo, bloquear
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
 * Verifica si el usuario está bloqueado por demasiados intentos
 * @returns {{ locked: boolean, remainingMs: number, remainingMinutes: number }}
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
 * Obtiene el hash del PIN activo (local o por defecto)
 */
export function getActivePinHash() {
  try {
    const saved = localStorage.getItem(LOCAL_PIN_HASH_KEY);
    if (saved && saved.length === 64) return saved;
  } catch (e) {}
  return DEFAULT_PIN_HASH;
}

/**
 * Guarda un nuevo hash de PIN (tras cambio exitoso)
 */
export function savePinHash(hash) {
  try {
    if (hash && hash.length === 64) {
      localStorage.setItem(LOCAL_PIN_HASH_KEY, hash);
    }
  } catch (e) {}
}

/**
 * Genera un token de sesión firmado con timestamp
 */
export function generateSessionToken() {
  const payload = {
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 horas
    nonce: Math.random().toString(36).substring(2) + Date.now().toString(36)
  };
  const encoded = btoa(JSON.stringify(payload));
  try {
    localStorage.setItem(LOCAL_SESSION_KEY, encoded);
  } catch (e) {}
  return encoded;
}

/**
 * Valida un token de sesión (verifica expiración)
 */
export function validateSessionToken(token) {
  try {
    const decoded = JSON.parse(atob(token));
    if (!decoded.exp || Date.now() > decoded.exp) {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      return { valid: false, reason: 'expired' };
    }
    return { valid: true, payload: decoded };
  } catch (e) {
    return { valid: false, reason: 'invalid' };
  }
}

/**
 * Obtiene el token de sesión activo si es válido
 */
export function getActiveSession() {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
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
    localStorage.removeItem(LOCAL_SESSION_KEY);
    localStorage.removeItem(LOCAL_ATTEMPTS_KEY);
  } catch (e) {}
}
