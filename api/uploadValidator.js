// ==============================================================================
// VALIDACIÓN ESTRICTA DE ARCHIVOS E IMÁGENES SUBIDAS (SEGURIDAD BACKEND)
// ==============================================================================
// Protege los endpoints de catálogo, comprobantes de pago y sesiones frente a:
// - Vectores XSS mediante imágenes SVG (`data:image/svg+xml` o `<svg`)
// - Discrepancia entre MIME declarado y firma binaria real (magic bytes)
// - Archivos corruptos o excesivamente pesados que saturen memoria o base de datos
// - Cantidad excesiva de archivos por lote/sesión
// ==============================================================================

import crypto from 'crypto';

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

export const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB por imagen de catálogo/galería
export const DEFAULT_MAX_VOUCHER_BYTES = 5 * 1024 * 1024; // 5 MB por comprobante de pago
export const DEFAULT_MAX_SESSION_PHOTOS = 500; // Máximo de fotos por sesión privada

/**
 * Detecta el MIME real de un Buffer inspeccionando sus magic bytes (firma binaria).
 */
export function detectBufferMimeType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Valida una imagen enviada como Data URL (`data:image/...;base64,...`) o URL remota/ruta local segura.
 * Rechaza siempre SVG, HTML incrustado, esquemas `javascript:` y binarios cuya firma real no sea JPEG/PNG/WebP.
 */
export function validateImagePayload(inputUrl, { maxBytes = DEFAULT_MAX_IMAGE_BYTES, allowRemoteHttps = true, allowRelativePath = true } = {}) {
  const raw = String(inputUrl ?? '').trim();
  if (!raw) {
    return { valid: false, error: 'La imagen o URL está vacía.' };
  }

  const lower = raw.toLowerCase();

  // Bloqueo explícito de SVG y esquemas ejecutables (XSS)
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html') ||
    lower.startsWith('data:image/svg') ||
    lower.includes('<svg') ||
    lower.includes('<script') ||
    lower.endsWith('.svg')
  ) {
    return { valid: false, error: 'Formato SVG o contenido ejecutable no permitido por seguridad.' };
  }

  // Caso 1: Data URL Base64
  if (lower.startsWith('data:')) {
    const match = raw.match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!match) {
      return { valid: false, error: 'Formato Data URL inválido o codificación no soportada.' };
    }

    const declaredMime = match[1].toLowerCase();
    const base64Data = match[2];

    if (!ALLOWED_IMAGE_MIMES.has(declaredMime)) {
      return { valid: false, error: `Tipo MIME no permitido (${declaredMime}). Usa JPEG, PNG o WebP.` };
    }

    let buffer;
    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch {
      return { valid: false, error: 'No se pudo decodificar el archivo Base64.' };
    }

    if (!buffer || buffer.length < 12) {
      return { valid: false, error: 'El archivo de imagen está vacío o corrupto.' };
    }

    if (buffer.length > maxBytes) {
      const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
      return { valid: false, error: `La imagen supera el límite máximo permitido de ${maxMb} MB.` };
    }

    const realMime = detectBufferMimeType(buffer);
    if (!realMime) {
      return { valid: false, error: 'El contenido binario no corresponde a una imagen válida (JPEG, PNG o WebP).' };
    }

    return {
      valid: true,
      kind: 'data-url',
      mime: realMime,
      sizeBytes: buffer.length
    };
  }

  // Caso 2: Ruta relativa del servidor (ej. /catalog/cat-123.jpg)
  if (allowRelativePath && raw.startsWith('/') && !raw.startsWith('//')) {
    if (raw.includes('..') || raw.includes('\\')) {
      return { valid: false, error: 'Ruta de imagen relativa no permitida.' };
    }
    return { valid: true, kind: 'relative-path', mime: null, sizeBytes: 0 };
  }

  // Caso 3: URL remota HTTPS
  if (allowRemoteHttps) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { valid: false, error: 'Solo se permiten URLs de imagen con protocolo HTTP/HTTPS.' };
      }
      return { valid: true, kind: 'remote-url', mime: null, sizeBytes: 0 };
    } catch {
      return { valid: false, error: 'URL de imagen inválida.' };
    }
  }

  return { valid: false, error: 'Formato de imagen no admitido.' };
}

/**
 * Valida un arreglo de fotos para creación de sesiones/galerías privadas.
 */
export function validateSessionPhotosBatch(photos, { maxPhotos = DEFAULT_MAX_SESSION_PHOTOS, maxBytesPerPhoto = DEFAULT_MAX_IMAGE_BYTES } = {}) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return { valid: false, error: 'La sesión debe incluir al menos una foto.' };
  }
  if (photos.length > maxPhotos) {
    return { valid: false, error: `Se excedió el límite máximo de ${maxPhotos} fotos por sesión.` };
  }
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (!p || typeof p !== 'object' || !p.url) {
      return { valid: false, error: `La foto en la posición #${i + 1} no contiene una imagen válida.` };
    }
    const check = validateImagePayload(p.url, { maxBytes: maxBytesPerPhoto });
    if (!check.valid) {
      return { valid: false, error: `Foto #${i + 1}: ${check.error}` };
    }
  }
  return { valid: true, count: photos.length };
}

/**
 * Genera un identificador de archivo/recurso seguro controlado por el servidor.
 */
export function generateSafeServerResourceId(prefix = 'img') {
  const cleanPrefix = String(prefix || 'img').replace(/[^a-z0-9_-]/gi, '').slice(0, 12) || 'img';
  return `${cleanPrefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}
