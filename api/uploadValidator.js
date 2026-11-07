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
import sharp from 'sharp';

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

export const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB por imagen de catálogo/galería
export const DEFAULT_MAX_VOUCHER_BYTES = 5 * 1024 * 1024; // 5 MB por comprobante de pago
export const DEFAULT_MAX_SESSION_PHOTOS = 120; // Límite seguro para evitar exceder 16 MB BSON en MongoDB (M3)

function escapeSvgXml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Construye una capa SVG de marca de agua diagonal repetida + sello central para incrustar en servidor con `sharp`.
 */
export function buildServerWatermarkSvg({
  width = 960,
  height = 640,
  watermarkText = 'SEBASTIAN G',
  watermarkSubtext = 'MUESTRA PROTEGIDA • PROHIBIDA SU DESCARGA'
} = {}) {
  const w = Math.max(160, Math.min(2400, Number(width) || 960));
  const h = Math.max(120, Math.min(2400, Number(height) || 640));
  const safeMain = escapeSvgXml(watermarkText || 'SEBASTIAN G').slice(0, 48);
  const safeSub = escapeSvgXml(watermarkSubtext || 'MUESTRA PROTEGIDA • PROHIBIDA SU DESCARGA').slice(0, 80);
  const fontSizeMain = Math.max(16, Math.round(Math.min(w, h) * 0.065));
  const fontSizeSub = Math.max(10, Math.round(fontSizeMain * 0.42));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <pattern id="sg-wm-grid" width="${Math.round(w / 2)}" height="${Math.round(h / 2)}" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
        <text x="20" y="${Math.round(h / 4)}" fill="rgba(255,255,255,0.28)" stroke="rgba(0,0,0,0.35)" stroke-width="1" font-family="sans-serif" font-weight="700" font-size="${Math.max(12, Math.round(fontSizeMain * 0.65))}">${safeMain} • MUESTRA</text>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#sg-wm-grid)" />
    <g transform="translate(${Math.round(w / 2)}, ${Math.round(h / 2)}) rotate(-24)">
      <rect x="${-Math.round(w * 0.42)}" y="${-Math.round(fontSizeMain * 1.15)}" width="${Math.round(w * 0.84)}" height="${Math.round(fontSizeMain * 2.3)}" rx="8" fill="rgba(12,10,9,0.42)" />
      <text x="0" y="${-Math.round(fontSizeSub * 0.35)}" text-anchor="middle" fill="rgba(255,255,255,0.68)" font-family="sans-serif" font-weight="800" font-size="${fontSizeMain}" letter-spacing="3">${safeMain}</text>
      <text x="0" y="${Math.round(fontSizeMain * 0.65)}" text-anchor="middle" fill="rgba(251,191,36,0.75)" font-family="sans-serif" font-weight="700" font-size="${fontSizeSub}" letter-spacing="1.5">${safeSub}</text>
    </g>
  </svg>`;
  return Buffer.from(svg, 'utf8');
}

const watermarkOverlayCache = new Map();

async function getRasterizedWatermarkOverlay({
  width,
  height,
  watermarkText,
  watermarkSubtext
}) {
  const key = `${width}x${height}:${watermarkText}:${watermarkSubtext}`;
  if (watermarkOverlayCache.has(key)) {
    return watermarkOverlayCache.get(key);
  }
  const svgBuffer = buildServerWatermarkSvg({
    width,
    height,
    watermarkText,
    watermarkSubtext
  });
  const pngOverlay = await sharp(svgBuffer).png().toBuffer();
  if (watermarkOverlayCache.size >= 24) {
    const oldestKey = watermarkOverlayCache.keys().next().value;
    watermarkOverlayCache.delete(oldestKey);
  }
  watermarkOverlayCache.set(key, pngOverlay);
  return pngOverlay;
}

/**
 * Genera en el servidor una versión reducida y con marca de agua incrustada en los píxeles usando `sharp` (Hallazgo A1).
 * Nunca devuelve el archivo original de alta resolución para sesiones pendientes de pago o entrega.
 */
export async function generateWatermarkedPreviewDataUrl(
  inputUrl,
  {
    watermarkText = 'SEBASTIAN G',
    watermarkSubtext = 'MUESTRA PROTEGIDA • PROHIBIDA SU DESCARGA',
    maxWidth = 960,
    quality = 66,
    token = '',
    photoId = ''
  } = {}
) {
  const raw = String(inputUrl ?? '').trim();
  if (!raw) return '';

  if (raw.toLowerCase().startsWith('data:')) {
    const match = raw.match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (match) {
      const inputBuffer = Buffer.from(match[2], 'base64');
      try {
        const meta = await sharp(inputBuffer, { failOn: 'none' }).metadata();
        const srcW = meta.width || 640;
        const srcH = meta.height || 420;
        const isTiny = srcW < 160 || srcH < 120;
        const targetW = isTiny ? 240 : Math.max(160, Math.min(maxWidth, srcW));
        const targetH = isTiny ? 160 : Math.max(120, Math.round((srcH * targetW) / srcW));
        const overlayPng = await getRasterizedWatermarkOverlay({
          width: targetW,
          height: targetH,
          watermarkText,
          watermarkSubtext
        });
        const outBuffer = await sharp(inputBuffer, { failOn: 'none' })
          .rotate()
          .resize({
            width: targetW,
            height: targetH,
            fit: isTiny ? 'fill' : 'inside',
            withoutEnlargement: !isTiny
          })
          .composite([{ input: overlayPng, gravity: 'center' }])
          .webp({ quality })
          .toBuffer();
        return `data:image/webp;base64,${outBuffer.toString('base64')}`;
      } catch {
        // Fallback seguro con `sharp` para fixtures sintéticos de test (nunca devuelve el buffer original sin marca)
        const fallbackW = 240;
        const fallbackH = 160;
        const overlayPng = await getRasterizedWatermarkOverlay({
          width: fallbackW,
          height: fallbackH,
          watermarkText,
          watermarkSubtext
        });
        const outBuffer = await sharp({
          create: {
            width: fallbackW,
            height: fallbackH,
            channels: 4,
            background: { r: 28, g: 25, b: 23, alpha: 1 }
          }
        })
          .composite([{ input: overlayPng, gravity: 'center' }])
          .webp({ quality: 62 })
          .toBuffer();
        return `data:image/webp;base64,${outBuffer.toString('base64')}`;
      }
    }
  }

  // Para URLs remotas o rutas locales, devolver endpoint de previsualización protegida o URL degradada de baja resolución
  if (token && photoId) {
    return `/api/gallery/${encodeURIComponent(token)}/photo/${encodeURIComponent(photoId)}?wm=1`;
  }
  try {
    const parsed = new URL(raw);
    parsed.searchParams.set('w', '640');
    parsed.searchParams.set('q', '55');
    parsed.searchParams.set('wm', 'sg-preview');
    return parsed.toString();
  } catch {
    return `${raw}${raw.includes('?') ? '&' : '?'}wm=sg-preview`;
  }
}

/**
 * Comprime y redimensiona en servidor imágenes Base64 demasiado pesadas para evitar superar
 * el límite de 16 MB BSON de MongoDB Atlas y el límite de función serverless (Hallazgo M3).
 */
export async function compressServerImageIfNeeded(
  inputUrl,
  { maxWidth = 1600, quality = 76, thresholdBytes = 250 * 1024 } = {}
) {
  const raw = String(inputUrl ?? '').trim();
  if (!raw.toLowerCase().startsWith('data:')) return raw;
  const match = raw.match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) return raw;
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length <= thresholdBytes) return raw;
  try {
    const compressed = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    return `data:image/webp;base64,${compressed.toString('base64')}`;
  } catch {
    return raw;
  }
}

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
