import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  detectBufferMimeType,
  validateImagePayload,
  validateSessionPhotosBatch
} from '../../api/uploadValidator.js';
import {
  maskEmail,
  maskPhone,
  generateGalleryToken,
  isValidGalleryTokenFormat,
  createAdminToken,
  verifyAdminToken,
  createApkDeviceToken,
  verifyApkDeviceToken,
  recordFinancialAuditLog,
  getTrustedClientIp,
  toMinimalApkFeed,
  isValidOfficialDomain
} from '../../api/security.js';
import app, {
  checkPublicWriteRateLimit,
  clearApiRateLimiters,
  runtimeDB
} from '../../api/index.js';
import {
  getColombiaTodayIso,
  isDateFullyBooked
} from '../services/bookingAvailability.js';
import { resolveRouteFromLocation } from '../App.jsx';
import { getCachedImage, setCachedImage } from '../components/ProtectedCanvasImage.jsx';

// Helper para invocar rutas de Express en memoria sin abrir puertos TCP
async function invokeApp(method, url, { body = {}, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url,
      originalUrl: url,
      path: url.split('?')[0],
      headers: {
        'content-type': 'application/json',
        ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
      },
      body,
      query: {},
      params: {},
      socket: { remoteAddress: '127.0.0.1' },
      get(name) {
        return this.headers[String(name).toLowerCase()];
      }
    };

    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(k, v) {
        this.headers[String(k).toLowerCase()] = v;
      },
      getHeader(k) {
        return this.headers[String(k).toLowerCase()];
      },
      json(payload) {
        this.body = payload;
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload) {
        this.body = payload;
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      end(payload) {
        if (payload !== undefined) this.body = payload;
        resolve({ status: this.statusCode, body: this.body });
        return this;
      }
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ status: res.statusCode, body: res.body });
    });
  });
}

describe('Auditoría de Seguridad, Subidas, Galerías Privadas y Webhooks', () => {
  beforeEach(() => {
    process.env.ADMIN_AUTH_SECRET = 'test-secret-de-al-menos-32-caracteres-seguros-2026';
    process.env.WOMPI_INTEGRITY_SECRET = 'test_integrity_secret_2026';
    process.env.WOMPI_EVENTS_SECRET = 'test_events_secret_2026';
    clearApiRateLimiters();
  });

  describe('1. Validación de Archivos e Imágenes (uploadValidator)', () => {
    it('detecta correctamente magic bytes de JPEG, PNG y WebP y rechaza texto arbitrario', () => {
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1]);
      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0, 0]);
      const webpBuf = Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'binary');
      const fakeBuf = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');

      expect(detectBufferMimeType(jpegBuf)).toBe('image/jpeg');
      expect(detectBufferMimeType(pngBuf)).toBe('image/png');
      expect(detectBufferMimeType(webpBuf)).toBe('image/webp');
      expect(detectBufferMimeType(fakeBuf)).toBeNull();
    });

    it('rechaza payloads SVG y vectores XSS en Data URLs o URLs', () => {
      const svgBase64 = Buffer.from('<svg onload="alert(1)"></svg>').toString('base64');
      const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

      expect(validateImagePayload(svgDataUrl).valid).toBe(false);
      expect(validateImagePayload('javascript:alert(1)').valid).toBe(false);
      expect(validateImagePayload('https://evil.com/xss.svg').valid).toBe(false);
    });

    it('rechaza archivos Base64 cuyo contenido binario no es una imagen real o excede el peso máximo', () => {
      const fakePng = `data:image/png;base64,${Buffer.from('no soy un png real sino texto largo').toString('base64')}`;
      expect(validateImagePayload(fakePng).valid).toBe(false);

      const validPngBytes = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(200, 0)
      ]);
      const validPngDataUrl = `data:image/png;base64,${validPngBytes.toString('base64')}`;
      expect(validateImagePayload(validPngDataUrl, { maxBytes: 1024 }).valid).toBe(true);
      expect(validateImagePayload(validPngDataUrl, { maxBytes: 50 }).valid).toBe(false);
    });

    it('valida lotes de fotos para sesiones privadas y bloquea exceso o archivos inválidos', () => {
      expect(validateSessionPhotosBatch([]).valid).toBe(false);
      expect(validateSessionPhotosBatch([{ url: 'https://sebastiang.app/foto1.jpg' }]).valid).toBe(true);
      expect(validateSessionPhotosBatch([{ url: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }]).valid).toBe(false);
    });
  });

  describe('2. Enmascaramiento de PII y Tokens Criptográficos de Galería', () => {
    it('enmascara correos electrónicos y teléfonos en logs para cumplir Habeas Data', () => {
      expect(maskEmail('anabeatrissantosyanez@gmail.com')).toBe('an***@gmail.com');
      expect(maskEmail('a@b.co')).toBe('a***@b.co');
      expect(maskEmail('')).toBe('[sin-email]');

      expect(maskPhone('+57 324 472 5167')).toBe('***5167');
      expect(maskPhone('12')).toBe('[tel-oculto]');
    });

    it('genera tokens criptográficos no predecibles y valida formato seguro', () => {
      const t1 = generateGalleryToken();
      const t2 = generateGalleryToken();
      expect(t1).not.toBe(t2);
      expect(t1.length).toBeGreaterThanOrEqual(32);
      expect(isValidGalleryTokenFormat(t1)).toBe(true);
      expect(isValidGalleryTokenFormat('../etc/passwd')).toBe(false);
      expect(isValidGalleryTokenFormat('corto')).toBe(false);
    });
  });

  describe('3. Protección de Galerías Privadas (Expiración, Revocación y Anti-Abuso)', () => {
    it('bloquea subida de fotos SVG al crear sesión, permite revocar y reactivar galería', async () => {
      const adminToken = createAdminToken({ pwd: 1 });
      const authHeaders = { authorization: `Bearer ${adminToken}` };

      // 1. Intentar crear sesión con SVG malicioso -> 400
      const badRes = await invokeApp('POST', '/api/admin/sessions', {
        headers: authHeaders,
        body: {
          clientName: 'Cliente Test',
          clientWhatsApp: '+573001112233',
          photos: [{ title: 'Maliciosa', url: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }]
        }
      });
      expect(badRes.status).toBe(400);

      // 2. Crear sesión legítima -> 201
      const createRes = await invokeApp('POST', '/api/admin/sessions', {
        headers: authHeaders,
        body: {
          clientName: 'Cliente Galería Segura',
          clientWhatsApp: '+573001112233',
          packageTitle: '8 Fotos Digitales',
          maxPhotosAllowed: 2,
          photos: [
            { title: 'Foto 1', url: 'https://sebastiang.app/catalog/foto1.jpg' },
            { title: 'Foto 2', url: 'https://sebastiang.app/catalog/foto2.jpg' }
          ]
        }
      });
      expect(createRes.status).toBe(201);
      const token = createRes.body.session.token;
      expect(isValidGalleryTokenFormat(token)).toBe(true);

      // 3. Revocar galería -> acceso público devuelve 403
      const revokeRes = await invokeApp('POST', `/api/admin/sessions/${token}/revoke`, {
        headers: authHeaders
      });
      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.session.revoked).toBe(true);

      const getRevoked = await invokeApp('GET', `/api/gallery/${token}`);
      expect(getRevoked.status).toBe(403);

      const submitRevoked = await invokeApp('POST', `/api/gallery/${token}/submit`, {
        body: { selections: [{ id: 'p1', selected: true }] }
      });
      expect(submitRevoked.status).toBe(403);

      // 4. Reactivar galería -> acceso público vuelve a 200
      const reopenRes = await invokeApp('POST', `/api/admin/sessions/${token}/reopen`, {
        headers: authHeaders,
        body: { additionalDays: 3, allowReSelection: true }
      });
      expect(reopenRes.status).toBe(200);

      const getReopened = await invokeApp('GET', `/api/gallery/${token}`);
      expect(getReopened.status).toBe(200);
      expect(getReopened.body.photos).toHaveLength(2);
    });

    it('impide publicar reseñas de galería con tokens inexistentes (404)', async () => {
      const res = await invokeApp('POST', '/api/gallery/token-falso-no-existe-12345/review', {
        body: { clientName: 'Spammer', rating: 5, comment: 'Falso' }
      });
      expect(res.status).toBe(404);
    });
  });

  describe('4. Idempotencia y Máquina de Estados en Webhook Wompi', () => {
    it('procesa un pago aprobado de forma idempotente y evita degradar pagos verificados', async () => {
      // Crear reserva para tener un bookingId válido
      const bookingRes = await invokeApp('POST', '/api/bookings', {
        body: {
          clientName: 'Cliente Wompi',
          clientWhatsApp: '+573109998877',
          packageId: 'pkg-4fotos',
          locationType: 'san_antero',
          specificLocation: 'Playa Blanca',
          dateTime: '2026-12-15 16:00',
          totalPrice: 45000
        }
      });
      expect(bookingRes.status).toBe(201);
      const bookingId = bookingRes.body.booking.id;

      // Iniciar checkout por el anticipo oficial ($20.000 COP)
      const checkoutRes = await invokeApp('POST', '/api/payments/checkout', {
        body: {
          bookingId,
          concept: 'booking_deposit',
          amount: 20000,
          clientName: 'Cliente Wompi',
          clientWhatsApp: '+573109998877'
        }
      });
      expect(checkoutRes.status).toBe(201);
      const { reference, amountInCents } = checkoutRes.body;

      const buildSignedEvent = (status, cents = amountInCents, txId = 'tx-wompi-999') => {
        const timestamp = 1792000000;
        const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
        const raw = `${txId}${status}${cents}${timestamp}${process.env.WOMPI_EVENTS_SECRET}`;
        const checksum = crypto.createHash('sha256').update(raw).digest('hex');
        return {
          event: 'transaction.updated',
          data: {
            transaction: {
              id: txId,
              reference,
              status,
              amount_in_cents: cents,
              payment_method_type: 'NEQUI'
            }
          },
          timestamp,
          signature: {
            properties,
            checksum
          }
        };
      };

      // 1. Primer webhook APPROVED -> actualiza estado a verified
      const firstHook = await invokeApp('POST', '/api/payments/webhook', {
        body: buildSignedEvent('APPROVED')
      });
      expect(firstHook.status).toBe(200);
      expect(firstHook.body.status).toBe('APPROVED');

      // 2. Segundo webhook APPROVED idéntico -> 200 idempotente
      const duplicateHook = await invokeApp('POST', '/api/payments/webhook', {
        body: buildSignedEvent('APPROVED')
      });
      expect(duplicateHook.status).toBe(200);
      expect(duplicateHook.body.idempotent).toBe(true);

      // 3. Evento tardío DECLINED sobre un pago YA verificado -> NO debe degradar el pago
      const lateDeclinedHook = await invokeApp('POST', '/api/payments/webhook', {
        body: buildSignedEvent('DECLINED', amountInCents, 'tx-wompi-old-attempt')
      });
      expect(lateDeclinedHook.status).toBe(200);
      expect(lateDeclinedHook.body.idempotent).toBe(true);

      // Verificar que el pago sigue en estado 'verified'
      const statusRes = await invokeApp('GET', `/api/payments/status/${reference}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.status).toBe('verified');
    });
  });

  describe('5. Rate Limiting por Ámbito (Scope Isolation)', () => {
    it('aísla los contadores de abuso por endpoint sin bloquear rutas distintas', () => {
      const ip = '203.0.113.55';
      expect(checkPublicWriteRateLimit(ip, 2, 'test-scope-a')).toBe(true);
      expect(checkPublicWriteRateLimit(ip, 2, 'test-scope-a')).toBe(true);
      expect(checkPublicWriteRateLimit(ip, 2, 'test-scope-a')).toBe(false);

      // Otro endpoint (scope distinto) sigue disponible para la misma IP
      expect(checkPublicWriteRateLimit(ip, 2, 'test-scope-b')).toBe(true);
    });
  });

  describe('6. Protección de /api/apk/feed y Prevención de Doble Reserva en Backend', () => {
    it('exige autenticación de administrador o APK_FEED_SECRET en GET /api/apk/feed', async () => {
      const unauthRes = await invokeApp('GET', '/api/apk/feed');
      expect(unauthRes.status).toBe(401);

      const adminToken = createAdminToken({ pwd: 1 });
      const authRes = await invokeApp('GET', '/api/apk/feed', {
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(authRes.status).toBe(200);
      expect(authRes.body.success).toBe(true);

      process.env.APK_FEED_SECRET = 'secret-apk-key-2026';
      const apkKeyRes = await invokeApp('GET', '/api/apk/feed', {
        headers: { 'x-apk-key': 'secret-apk-key-2026' }
      });
      expect(apkKeyRes.status).toBe(200);
      delete process.env.APK_FEED_SECRET;
    });

    it('rechaza reservas solapadas en la misma fecha y ventana de 120 minutos con 409 Conflict', async () => {
      const firstRes = await invokeApp('POST', '/api/bookings', {
        body: {
          clientName: 'Cliente Turno 1',
          clientWhatsApp: '+573001112244',
          packageId: 'pkg-4fotos',
          locationType: 'san_antero',
          specificLocation: 'Playa Blanca',
          dateTime: '22/11/2026 a las 4:00 p. m.',
          totalPrice: 45000
        }
      });
      expect(firstRes.status).toBe(201);

      // Misma fecha 1 hora después (dentro de los 120 min de la sesión anterior) -> 409
      const overlapRes = await invokeApp('POST', '/api/bookings', {
        body: {
          clientName: 'Cliente Solapado',
          clientWhatsApp: '+573009998877',
          packageId: 'pkg-4fotos',
          locationType: 'san_antero',
          specificLocation: 'Playa Blanca',
          dateTime: '22/11/2026 a las 5:00 p. m.',
          totalPrice: 45000
        }
      });
      expect(overlapRes.status).toBe(409);
      expect(overlapRes.body.code).toBe('SLOT_ALREADY_BOOKED');

      // 2 horas después (6:00 p. m., justo cuando termina la de 4:00 p. m.) -> 201
      const nextSlotRes = await invokeApp('POST', '/api/bookings', {
        body: {
          clientName: 'Cliente Turno 2',
          clientWhatsApp: '+573009998877',
          packageId: 'pkg-4fotos',
          locationType: 'san_antero',
          specificLocation: 'Playa Blanca',
          dateTime: '22/11/2026 a las 6:00 p. m.',
          totalPrice: 45000
        }
      });
      expect(nextSlotRes.status).toBe(201);
    });
  });

  describe('7. Zona Horaria Colombia, Ruteo Centralizado, Caché LRU y Accesibilidad Frontend', () => {
    it('calcula la fecha actual en zona horaria America/Bogota sin saltar al día siguiente a las 7:00 p. m.', () => {
      // 2026-10-27T01:30:00.000Z equivale a 2026-10-26 20:30 (8:30 p. m.) en Colombia (UTC-5)
      const nightInColombia = new Date('2026-10-27T01:30:00.000Z');
      expect(getColombiaTodayIso(nightInColombia)).toBe('2026-10-26');
    });

    it('distingue días parcialmente ocupados de días con agenda llena (isDateFullyBooked)', () => {
      expect(isDateFullyBooked([])).toBe(false);
      // 1 sesión de 9:00 a. m. a 11:00 a. m. -> día NO lleno
      expect(isDateFullyBooked([{ startMin: 540, endMin: 660 }])).toBe(false);
      // Sesión que termina a las 8:30 p. m. (1230 min > 1170 min) -> día lleno
      expect(isDateFullyBooked([{ startMin: 1110, endMin: 1230 }])).toBe(true);
    });

    it('centraliza la resolución de rutas en resolveRouteFromLocation()', () => {
      expect(resolveRouteFromLocation({ pathname: '/', search: '', hash: '' }).view).toBe('home');
      expect(resolveRouteFromLocation({ pathname: '/paquetes', search: '', hash: '' }).view).toBe('packages');
      expect(resolveRouteFromLocation({ pathname: '/tarifas/', search: '', hash: '' }).view).toBe('packages');
      expect(resolveRouteFromLocation({ pathname: '/admin', search: '', hash: '' }).view).toBe('admin');
      expect(resolveRouteFromLocation({ pathname: '/', search: '?mode=admin', hash: '' }).view).toBe('admin');
      expect(resolveRouteFromLocation({ pathname: '/calificar', search: '', hash: '' }).view).toBe('review');

      const gal = resolveRouteFromLocation({ pathname: '/galeria/tok-abc-123', search: '', hash: '' });
      expect(gal.view).toBe('gallery');
      expect(gal.galleryToken).toBe('tok-abc-123');

      const rec = resolveRouteFromLocation({ pathname: '/', search: '', hash: '#recibo=rcpt-999' });
      expect(rec.view).toBe('receipt');
      expect(rec.receiptId).toBe('rcpt-999');
    });

    it('acota la caché en memoria de imágenes con política LRU (máx. 40 entradas)', () => {
      for (let i = 0; i < 45; i++) {
        setCachedImage(`https://sebastiang.app/test-${i}.jpg`, { id: i, complete: true, naturalWidth: 800 });
      }
      // Las primeras 5 deben haber sido desalojadas por límite LRU = 40
      expect(getCachedImage('https://sebastiang.app/test-0.jpg')).toBeNull();
      expect(getCachedImage('https://sebastiang.app/test-44.jpg')).not.toBeNull();
    });

    it('verifica contratos de accesibilidad, zoom móvil, impresión de recibo y ausencia de bloqueos globales', () => {
      const rootDir = process.cwd();
      const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
      expect(indexHtml).not.toContain('user-scalable=no');
      expect(indexHtml).not.toContain('maximum-scale=1.0');

      const styleCss = fs.readFileSync(path.join(rootDir, 'src/style.css'), 'utf8');
      // No debe existir un @media print que oculte html, body con display: none
      expect(styleCss).not.toMatch(/html,\s*body\s*\{\s*display:\s*none\s*!important/);
      expect(styleCss).toContain('#sebastian-g-digital-receipt');

      const appJsx = fs.readFileSync(path.join(rootDir, 'src/App.jsx'), 'utf8');
      expect(appJsx).not.toContain('blockInspect');
      expect(appJsx).not.toContain('blockContextMenu');

      const bookingModalJsx = fs.readFileSync(path.join(rootDir, 'src/components/BookingModal.jsx'), 'utf8');
      expect(bookingModalJsx).toContain('role="dialog"');
      expect(bookingModalJsx).toContain('aria-modal="true"');
      expect(bookingModalJsx).toContain('aria-labelledby="booking-modal-title"');

      const catalogJsx = fs.readFileSync(path.join(rootDir, 'src/components/Catalog.jsx'), 'utf8');
      expect(catalogJsx).toContain('role="dialog"');
      expect(catalogJsx).toContain('aria-modal="true"');
      expect(catalogJsx).toContain('aria-labelledby="catalog-preview-title"');

      const clientGalleryJsx = fs.readFileSync(path.join(rootDir, 'src/components/ClientGallery.jsx'), 'utf8');
      expect(clientGalleryJsx).toContain('role="dialog"');
      expect(clientGalleryJsx).toContain('aria-modal="true"');
      expect(clientGalleryJsx).toContain('aria-labelledby="client-gallery-confirm-title"');
    });
  });

  describe('8. Minimización de PII en APK Feed, Anti-Spoofing de IP y Fuente Única de Verdad (MongoDB)', () => {
    it('minimiza el payload de /api/apk/feed eliminando teléfonos, correos, tokens y fotos privadas', async () => {
      const reduced = toMinimalApkFeed({
        bookings: [{
          id: 'book-123',
          clientName: 'María Fernanda Gómez',
          clientWhatsApp: '+573001112233',
          clientEmail: 'maria@gmail.com',
          receiptToken: 'secret-receipt-token',
          receiptUrl: 'https://sebastiang.app/#recibo=secret',
          packageName: '8 Fotos Digitales',
          dateTime: '25/11/2026 a las 4:00 p. m.',
          totalPrice: 75000,
          status: 'confirmed',
          createdAt: '2026-10-26T12:00:00.000Z'
        }],
        payments: [{
          id: 'pay-123',
          clientName: 'María Fernanda Gómez',
          clientWhatsApp: '+573001112233',
          sessionToken: 'secret-session-token',
          voucherUrl: 'data:image/png;base64,AAA',
          amount: 20000,
          method: 'nequi',
          concept: 'Anticipo',
          status: 'verified',
          createdAt: '2026-10-26T12:05:00.000Z'
        }],
        sessions: [{
          id: 'sess-123',
          token: 'secret-gallery-token',
          clientName: 'María Fernanda Gómez',
          clientWhatsApp: '+573001112233',
          packageTitle: '8 Fotos Digitales',
          status: 'submitted',
          photos: [{ id: 'p1', url: 'https://private/photo.jpg', selected: true }]
        }],
        reviews: [{
          id: 'rev-123',
          clientName: 'María Fernanda Gómez',
          rating: 5,
          recommend: true,
          date: '26/10/2026'
        }]
      });

      expect(reduced.bookings[0].clientFirstName).toBe('María');
      expect(reduced.bookings[0].clientWhatsApp).toBeUndefined();
      expect(reduced.bookings[0].clientEmail).toBeUndefined();
      expect(reduced.bookings[0].receiptToken).toBeUndefined();
      expect(reduced.bookings[0].receiptUrl).toBeUndefined();

      expect(reduced.payments[0].clientFirstName).toBe('María');
      expect(reduced.payments[0].clientWhatsApp).toBeUndefined();
      expect(reduced.payments[0].sessionToken).toBeUndefined();
      expect(reduced.payments[0].voucherUrl).toBeUndefined();

      expect(reduced.sessions[0].clientFirstName).toBe('María');
      expect(reduced.sessions[0].token).toBeUndefined();
      expect(reduced.sessions[0].photos).toBeUndefined();
      expect(reduced.sessions[0].selectedCount).toBe(1);
    });

    it('ignora headers X-Forwarded-For falsificados salvo en proxy confiable o Vercel', () => {
      const oldVercel = process.env.VERCEL;
      const oldTrustProxy = process.env.TRUST_PROXY;
      delete process.env.VERCEL;
      delete process.env.TRUST_PROXY;

      try {
        // 1. Sin proxy confiable: X-Forwarded-For falsificado se ignora y se usa socket.remoteAddress
        const spoofedReq = {
          headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
          socket: { remoteAddress: '::ffff:198.51.100.25' }
        };
        expect(getTrustedClientIp(spoofedReq)).toBe('198.51.100.25');

        // 2. En Vercel (VERCEL=1): usa x-vercel-forwarded-for inyectado por el edge
        process.env.VERCEL = '1';
        const vercelReq = {
          headers: {
            'x-forwarded-for': '9.9.9.9',
            'x-vercel-forwarded-for': '203.0.113.77'
          },
          socket: { remoteAddress: '10.0.0.1' }
        };
        expect(getTrustedClientIp(vercelReq)).toBe('203.0.113.77');
        delete process.env.VERCEL;

        // 3. Con TRUST_PROXY=true: toma el último salto añadido por el proxy (rightmost hop), no el primero falsificable
        process.env.TRUST_PROXY = 'true';
        const proxyReq = {
          headers: { 'x-forwarded-for': '1.1.1.1, 198.51.100.99' },
          socket: { remoteAddress: '10.0.0.1' }
        };
        expect(getTrustedClientIp(proxyReq)).toBe('198.51.100.99');
      } finally {
        if (oldVercel !== undefined) process.env.VERCEL = oldVercel;
        else delete process.env.VERCEL;
        if (oldTrustProxy !== undefined) process.env.TRUST_PROXY = oldTrustProxy;
        else delete process.env.TRUST_PROXY;
      }
    });

    it('verifica que el frontend y el backend hayan eliminado por completo Supabase y que CI bloquee vulnerabilidades', () => {
      const rootDir = process.cwd();
      const apiJs = fs.readFileSync(path.join(rootDir, 'src/services/api.js'), 'utf8');
      const appJsx = fs.readFileSync(path.join(rootDir, 'src/App.jsx'), 'utf8');
      const adminJsx = fs.readFileSync(path.join(rootDir, 'src/components/AdminPanel.jsx'), 'utf8');
      const auditorJs = fs.readFileSync(path.join(rootDir, 'src/services/systemAuditor.js'), 'utf8');
      const backendIndexJs = fs.readFileSync(path.join(rootDir, 'api/index.js'), 'utf8');
      const backendSecurityJs = fs.readFileSync(path.join(rootDir, 'api/security.js'), 'utf8');
      const envExample = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');

      expect(apiJs).not.toContain('supabase.from(');
      expect(appJsx).not.toContain('supabase.channel(');
      expect(adminJsx).not.toContain('supabase.channel(');
      expect(auditorJs).not.toContain("from './supabase'");
      expect(fs.existsSync(path.join(rootDir, 'src/services/supabase.js'))).toBe(false);

      // Cero fallbacks ni variables de Supabase en el backend
      expect(backendIndexJs).not.toContain('SUPABASE_REST_KEY');
      expect(backendIndexJs).not.toContain('SUPABASE_REST_URL');
      expect(backendIndexJs).not.toContain('supaFetch');
      expect(backendSecurityJs).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(envExample).not.toContain('SUPABASE_REST_URL=');
      expect(envExample).toContain('MONGODB_URI=');

      const ciYml = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');
      expect(ciYml).toContain('npm audit --omit=dev');
      expect(ciYml).not.toContain('|| true');

      // Limpieza de CSP en Vercel y exclusiones en Service Worker
      const vercelJson = fs.readFileSync(path.join(rootDir, 'vercel.json'), 'utf8');
      const swJs = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');
      expect(vercelJson).not.toContain('supabase.co');
      expect(swJs).not.toContain('supabase.co');
      expect(adminJsx).not.toContain('(Supabase Cloud)');
      expect(adminJsx).not.toContain('fotos sincronizadas con Supabase Cloud');
    });

    it('verifica que el proyecto Android nativo (android/) cumpla con los estándares de seguridad móvil (Keystore, WebView endurecido y Manifest)', () => {
      const rootDir = process.cwd();
      const manifestPath = path.join(rootDir, 'android/app/src/main/AndroidManifest.xml');
      const mainActivityPath = path.join(rootDir, 'android/app/src/main/java/app/sebastiang/studio/MainActivity.kt');
      const tokenStoragePath = path.join(rootDir, 'android/app/src/main/java/app/sebastiang/studio/security/SecureTokenStorage.kt');
      const bridgePath = path.join(rootDir, 'android/app/src/main/java/app/sebastiang/studio/bridge/AndroidNotificationBridge.kt');
      const domainValidatorPath = path.join(rootDir, 'android/app/src/main/java/app/sebastiang/studio/security/DomainValidator.kt');
      const buildGradlePath = path.join(rootDir, 'android/app/build.gradle.kts');

      expect(fs.existsSync(manifestPath)).toBe(true);
      expect(fs.existsSync(mainActivityPath)).toBe(true);
      expect(fs.existsSync(tokenStoragePath)).toBe(true);
      expect(fs.existsSync(bridgePath)).toBe(true);
      expect(fs.existsSync(domainValidatorPath)).toBe(true);
      expect(fs.existsSync(buildGradlePath)).toBe(true);

      const manifest = fs.readFileSync(manifestPath, 'utf8');
      expect(manifest).toContain('android:usesCleartextTraffic="false"');
      expect(manifest).toContain('android:allowBackup="false"');

      const domainValidator = fs.readFileSync(domainValidatorPath, 'utf8');
      expect(domainValidator).toContain('ALLOWED_HOSTS = setOf(');
      expect(domainValidator).toContain('"sebastiang.app"');
      expect(domainValidator).toContain('uri.host?.lowercase()');
      expect(domainValidator).not.toContain('.startsWith('); // Prohibido usar startsWith para validación de host

      const mainActivity = fs.readFileSync(mainActivityPath, 'utf8');
      expect(mainActivity).toContain('WebView.setWebContentsDebuggingEnabled(false)');
      expect(mainActivity).toContain('allowFileAccess = false');
      expect(mainActivity).toContain('allowContentAccess = false');
      expect(mainActivity).toContain('DomainValidator.isAllowedUrl(url)');

      const tokenStorage = fs.readFileSync(tokenStoragePath, 'utf8');
      expect(tokenStorage).toContain('MasterKey.KeyScheme.AES256_GCM');
      expect(tokenStorage).toContain('EncryptedSharedPreferences');

      const bridge = fs.readFileSync(bridgePath, 'utf8');
      expect(bridge).toContain('DomainValidator.isAllowedUrl');
      expect(bridge).toContain('@JavascriptInterface');

      const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
      expect(buildGradle).toContain('isMinifyEnabled = true');
      expect(buildGradle).toContain('androidx.security:security-crypto');
    });

    it('comprueba funcionalmente DomainValidator (rechazo de prefijos, puertos no autorizados, HTTP y credenciales)', () => {
      // Válidos
      expect(isValidOfficialDomain('https://sebastiang.app')).toBe(true);
      expect(isValidOfficialDomain('https://sebastiang.app/')).toBe(true);
      expect(isValidOfficialDomain('https://www.sebastiang.app')).toBe(true);
      expect(isValidOfficialDomain('https://sebastiang.app/api/apk/feed')).toBe(true);
      expect(isValidOfficialDomain('https://sebastiang.app:443/agenda')).toBe(true);

      // Ataques de prefijo con startsWith (¡deben ser rechazados!)
      expect(isValidOfficialDomain('https://sebastiang.app.ejemplo.com')).toBe(false);
      expect(isValidOfficialDomain('https://sebastiang.app.attacker.com/malicious')).toBe(false);
      expect(isValidOfficialDomain('https://sebastiang.app-phishing.com')).toBe(false);

      // Esquemas no permitidos
      expect(isValidOfficialDomain('http://sebastiang.app')).toBe(false);
      expect(isValidOfficialDomain('javascript:alert(1)')).toBe(false);
      expect(isValidOfficialDomain('file:///etc/passwd')).toBe(false);

      // Puertos no autorizados
      expect(isValidOfficialDomain('https://sebastiang.app:8080')).toBe(false);
      expect(isValidOfficialDomain('https://sebastiang.app:3000')).toBe(false);

      // Credenciales embebidas en URL (evitar user:pass@host)
      expect(isValidOfficialDomain('https://admin:secret@sebastiang.app')).toBe(false);

      // Valores nulos o vacíos
      expect(isValidOfficialDomain('')).toBe(false);
      expect(isValidOfficialDomain('   ')).toBe(false);
      expect(isValidOfficialDomain(null)).toBe(false);
      expect(isValidOfficialDomain(undefined)).toBe(false);
    });

    it('garantiza reconciliación de reservas en reintentos de webhook si la reserva quedó pendiente por fallo previo', async () => {
      // Simular un pago que ya está 'verified' en memoria pero cuya reserva quedó 'pending' (p. ej. por un fallo transitorio)
      const orphanBookingId = 'book-reconcile-test-01';
      runtimeDB.bookings.unshift({
        id: orphanBookingId,
        clientName: 'Reconcile Test',
        status: 'pending',
        depositPaid: false
      });
      const paymentRef = 'ref-wompi-reconcile-01';
      runtimeDB.payments.unshift({
        id: 'pay-reconcile-01',
        reference: paymentRef,
        bookingId: orphanBookingId,
        amount: 20000,
        status: 'verified' // Pago ya verificado previamente
      });

      const txId = 'tx-reconcile-01';
      const amountInCents = 2000000;
      const ts = 1799000000;
      const rawChecksum = `${txId}APPROVED${amountInCents}${ts}${process.env.WOMPI_EVENTS_SECRET}`;
      const checksum = crypto.createHash('sha256').update(rawChecksum).digest('hex');

      const webhookPayload = {
        event: 'transaction.updated',
        data: {
          transaction: {
            id: txId,
            reference: paymentRef,
            status: 'APPROVED',
            amount_in_cents: amountInCents
          }
        },
        timestamp: ts,
        signature: {
          properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
          checksum
        }
      };

      const res = await invokeApp('POST', '/api/payments/webhook', { body: webhookPayload });
      expect(res.status).toBe(200);
      expect(res.body.idempotent).toBe(true);

      // La reserva DEBE haber sido reconciliada a 'confirmed' y 'depositPaid: true'
      const updatedBooking = runtimeDB.bookings.find(b => b.id === orphanBookingId);
      expect(updatedBooking.status).toBe('confirmed');
      expect(updatedBooking.depositPaid).toBe(true);
    });

    it('emite tokens de dispositivo APK con alcance exclusivo apk_feed:read (no admin) y permite revocarlos', async () => {
      const adminToken = createAdminToken({ pwd: 1 });

      // 1. Registrar dispositivo APK desde sesión admin
      const regRes = await invokeApp('POST', '/api/admin/apk-devices/register', {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { deviceId: 'apk-pixel-test-01', deviceName: 'Pixel 9 Pro de Sebastian' }
      });
      expect(regRes.status).toBe(201);
      expect(regRes.body.scope).toBe('apk_feed:read');
      const deviceToken = regRes.body.deviceToken;
      expect(typeof deviceToken).toBe('string');

      // 2. El token de dispositivo APK NUNCA es aceptado como token de administrador
      expect(verifyAdminToken(deviceToken)).toBeNull();
      const adminAttempt = await invokeApp('GET', '/api/admin/bookings', {
        headers: { Authorization: `Bearer ${deviceToken}` }
      });
      expect(adminAttempt.status).toBe(401);

      // 3. El token de dispositivo APK SÍ permite leer el feed reducido /api/apk/feed
      const feedOk = await invokeApp('GET', '/api/apk/feed', {
        headers: { 'x-apk-device-token': deviceToken }
      });
      expect(feedOk.status).toBe(200);
      expect(feedOk.body.success).toBe(true);

      // 4. Al revocar el dispositivo, el token queda bloqueado inmediatamente
      const revokeRes = await invokeApp('POST', '/api/admin/apk-devices/revoke', {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { deviceId: 'apk-pixel-test-01' }
      });
      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.revokedApkDeviceIds).toContain('apk-pixel-test-01');

      const feedRevoked = await invokeApp('GET', '/api/apk/feed', {
        headers: { 'x-apk-device-token': deviceToken }
      });
      expect(feedRevoked.status).toBe(401);
    });

    it('registra bitácora de auditoría financiera y expone snapshot de respaldo autenticado', async () => {
      const adminToken = createAdminToken({ pwd: 1 });

      const logsRes = await invokeApp('GET', '/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(logsRes.status).toBe(200);
      expect(Array.isArray(logsRes.body.logs)).toBe(true);
      expect(logsRes.body.logs.length).toBeGreaterThan(0);

      const backupRes = await invokeApp('GET', '/api/admin/backup', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(backupRes.status).toBe(200);
      expect(backupRes.body.sourceOfTruth).toBe('mongodb-atlas');
      expect(backupRes.body.snapshot).toBeDefined();
    });
  });
});
