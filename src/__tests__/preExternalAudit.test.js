import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import app, {
  HARDENED_CONTENT_SECURITY_POLICY,
  clearApiRateLimiters,
  runtimeDB
} from '../../api/index.js';
import {
  ADMIN_SESSION_COOKIE_NAME,
  createAdminToken,
  getAdminAuthSecret,
  isForbiddenWeakPassword
} from '../../api/security.js';
import { validateImagePayload, isPrivateOrLocalHost } from '../../api/uploadValidator.js';
import { resolvePropertyPath, verifyWompiChecksum } from '../../api/payments/gateway.js';
import { calculateBookingPriceBand } from '../../shared/pricing.js';
import { validateReferralCode } from '../../api/referrals.js';
import { isReturningClient } from '../../api/pricingGuard.js';
import { sendBookingConfirmedEmail } from '../../api/emailService.js';
import { handleEmergencyPasswordReset, clearRateLimiters } from '../../api/passwordReset.js';

async function invokeApp(method, url, { body = {}, headers = {}, remoteAddress = '127.0.0.1' } = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url, 'http://localhost');
    const req = {
      method: method.toUpperCase(),
      url,
      originalUrl: url,
      path: parsedUrl.pathname,
      headers: {
        'content-type': 'application/json',
        ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
      },
      body,
      query: Object.fromEntries(parsedUrl.searchParams.entries()),
      params: {},
      socket: { remoteAddress },
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
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
      send(payload) {
        this.body = payload;
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
      end(payload) {
        if (payload !== undefined) this.body = payload;
        resolve({ status: this.statusCode, body: this.body, headers: this.headers });
        return this;
      }
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ status: res.statusCode, body: res.body, headers: res.headers });
    });
  });
}

describe('Pre-External Audit Hardening & Bug-Fix Regression Suite', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_MONGO_IN_TESTS;
    delete process.env.MONGODB_URI;
    process.env.ADMIN_AUTH_SECRET = 'test-secret-de-al-menos-32-caracteres-seguros-2026';
    process.env.WOMPI_EVENTS_SECRET = 'test_events_secret_2026';
    if (runtimeDB?.settings) {
      runtimeDB.settings.adminPasswordVersion = 1;
    }
    clearApiRateLimiters();
    clearRateLimiters();
  });

  describe('1. SSRF IPv6 / Metadatos & SVG Query-String Bypass (uploadValidator)', () => {
    it('bloquea direcciones IPv6 con corchetes, IPv4-mapped IPv6, CGNAT, 0.0.0.0 y metadatos cloud', () => {
      expect(isPrivateOrLocalHost('[::1]')).toBe(true);
      expect(isPrivateOrLocalHost('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateOrLocalHost('[fc00::1]')).toBe(true);
      expect(isPrivateOrLocalHost('[fe80::1]')).toBe(true);
      expect(isPrivateOrLocalHost('0.0.0.0')).toBe(true);
      expect(isPrivateOrLocalHost('100.64.0.1')).toBe(true);
      expect(isPrivateOrLocalHost('metadata.google.internal')).toBe(true);
      expect(isPrivateOrLocalHost('printer.local')).toBe(true);
      expect(isPrivateOrLocalHost('sebastiang.app')).toBe(false);

      expect(validateImagePayload('https://[::1]/secret.jpg').valid).toBe(false);
      expect(validateImagePayload('https://[::ffff:127.0.0.1]/secret.jpg').valid).toBe(false);
      expect(validateImagePayload('https://metadata.google.internal/computeMetadata/v1/').valid).toBe(false);
      expect(validateImagePayload('https://admin:pass@sebastiang.app/photo.jpg').valid).toBe(false);
    });

    it('bloquea archivos SVG camuflados con query strings o fragmentos', () => {
      expect(validateImagePayload('https://evil.example.com/payload.svg?v=123').valid).toBe(false);
      expect(validateImagePayload('https://evil.example.com/payload.svgz#hash').valid).toBe(false);
      expect(validateImagePayload('/uploads/avatar.svg?cache=1').valid).toBe(false);
      expect(validateImagePayload('https://sebastiang.app/catalog/foto.jpg?v=2').valid).toBe(true);
    });
  });

  describe('2. Seguridad Wompi, Prototype Pollution y Correo de Confirmación', () => {
    it('resolvePropertyPath bloquea acceso a __proto__, constructor, prototype y cadena de prototipos', () => {
      const sample = { transaction: { id: 'tx-1' } };
      expect(resolvePropertyPath(sample, 'transaction.id')).toBe('tx-1');
      expect(resolvePropertyPath(sample, '__proto__.toString')).toBe('');
      expect(resolvePropertyPath(sample, 'constructor.name')).toBe('');
      expect(resolvePropertyPath(sample, 'transaction.toString')).toBe('');
    });

    it('verifyWompiChecksum rechaza signature.properties vacío o mal formado', () => {
      const ts = Math.floor(Date.now() / 1000);
      const emptyHash = crypto.createHash('sha256').update(`${ts}test_events_secret_2026`).digest('hex');
      expect(
        verifyWompiChecksum({
          eventPayload: {
            data: { transaction: { id: 'tx-1' } },
            timestamp: ts,
            signature: { properties: [], checksum: emptyHash }
          },
          eventsSecret: 'test_events_secret_2026'
        })
      ).toBe(false);
    });

    it('sendBookingConfirmedEmail tolera customNotes no-string sin lanzar TypeError y api/index.js no pasa runtimeDB.settings', async () => {
      await expect(sendBookingConfirmedEmail({ clientEmail: 'cliente@example.com' }, { notAString: true })).resolves.toBe(false);
      const apiIndexCode = fs.readFileSync(path.join(process.cwd(), 'api/index.js'), 'utf8');
      expect(apiIndexCode).not.toContain('sendBookingConfirmedEmail(approvedBooking, runtimeDB.settings)');
    });

    it('webhook DECLINED de session_balance NO revierte depositPaid de una reserva ya confirmada', async () => {
      const bId = 'book-keep-deposit-' + Date.now();
      const ref = 'ref-bal-declined-' + Date.now();
      runtimeDB.bookings = [{
        id: bId,
        clientName: 'Cliente Confirmado',
        status: 'confirmed',
        depositPaid: true,
        totalPrice: 100000
      }];
      runtimeDB.payments = [{
        id: 'pay-bal-declined-1',
        bookingId: bId,
        reference: ref,
        amount: 80000,
        concept: 'session_balance',
        status: 'pending_gateway'
      }];

      const ts = Math.floor(Date.now() / 1000);
      const checksum = crypto.createHash('sha256').update(`tx-dec-1DECLINED8000000${ts}test_events_secret_2026`).digest('hex');
      const res = await invokeApp('POST', '/api/payments/webhook', {
        body: {
          event: 'transaction.updated',
          timestamp: ts,
          data: {
            transaction: {
              id: 'tx-dec-1',
              reference: ref,
              status: 'DECLINED',
              amount_in_cents: 8000000,
              currency: 'COP'
            }
          },
          signature: {
            properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
            checksum
          }
        }
      });

      expect(res.status).toBe(200);
      const b = runtimeDB.bookings.find(item => item.id === bId);
      expect(b.depositPaid).toBe(true);
      expect(b.status).toBe('confirmed');
    });
  });

  describe('3. Anti-Enumeración Fidelidad, Precios, Cabeceras y Endpoints Endurecidos', () => {
    it('impide bypass de fidelidad repitiendo el mismo nombre ("Maria Maria") y excluye reservas canceladas', async () => {
      runtimeDB.bookings = [
        { id: 'b-dup-1', clientName: 'Maria Gonzalez', clientWhatsApp: '+573199990001', status: 'completed' },
        { id: 'b-canc-1', clientName: 'Pedro Cancelled', clientWhatsApp: '+573199990002', status: 'cancelled' }
      ];

      const dupBypassAttempt = await invokeApp(
        'GET',
        '/api/public/loyalty?phone=573199990001&clientName=Maria%20Maria',
        { remoteAddress: '198.51.100.201' }
      );
      expect(dupBypassAttempt.status).toBe(200);
      expect(dupBypassAttempt.body.isLoyal).toBe(false);

      const cancelledAttempt = await invokeApp(
        'GET',
        '/api/public/loyalty?phone=573199990002&clientName=Pedro%20Cancelled',
        { remoteAddress: '198.51.100.202' }
      );
      expect(cancelledAttempt.status).toBe(200);
      expect(cancelledAttempt.body.isLoyal).toBe(false);

      expect(isReturningClient({ bookings: runtimeDB.bookings, sessions: [], phone: '+573199990002' })).toBe(false);
      expect(
        validateReferralCode({
          code: '3199990002',
          clientPhone: '3112223344',
          bookings: runtimeDB.bookings,
          sessions: []
        }).valid
      ).toBe(false);
    });

    it('desactiva X-Powered-By y alinea CSP + COOP + CORP en Express', async () => {
      expect(app.get('x-powered-by')).toBe(false);
      expect(HARDENED_CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
      expect(HARDENED_CONTENT_SECURITY_POLICY).toContain("base-uri 'self'");
      expect(HARDENED_CONTENT_SECURITY_POLICY).toContain("form-action 'self'");
      expect(HARDENED_CONTENT_SECURITY_POLICY).toContain('upgrade-insecure-requests');

      const healthRes = await invokeApp('GET', '/api/health');
      expect(healthRes.headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(healthRes.headers['cross-origin-resource-policy']).toBe('same-origin');
    });

    it('preserva locationType="outside_san_antero" en POST /api/bookings', async () => {
      const res = await invokeApp('POST', '/api/bookings', {
        body: {
          clientName: 'Cliente Fuera San Antero',
          clientWhatsApp: '+573155551122',
          packageId: 'pkg-4fotos',
          locationType: 'outside_san_antero',
          specificLocation: 'Coveñas',
          dateTime: '28/12/2026 a las 4:00 p. m.',
          totalPrice: 55000
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.booking.locationType).toBe('outside_san_antero');
      expect(res.body.booking.totalPrice).toBe(55000);
    });

    it('GET /api/gallery/:token/photo/:photoId bloquea galerías expiradas con HTTP 410', async () => {
      const token = 'gal-expired-photo-' + Date.now();
      runtimeDB.sessions = [{
        id: 'sess-exp-1',
        token,
        clientName: 'Cliente Expirado',
        status: 'pending',
        expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        photos: [{ id: 'p1', url: 'https://sebastiang.app/catalog/foto1.jpg' }]
      }];

      const res = await invokeApp('GET', `/api/gallery/${token}/photo/p1`);
      expect(res.status).toBe(410);
    });

    it('POST /api/payments rechaza montos <= 0 o inválidos y sanitiza HTML en resúmenes', async () => {
      const bId = 'book-pay-val-' + Date.now();
      runtimeDB.bookings = [{ id: bId, clientName: 'Cliente Pago', totalPrice: 75000, status: 'pending' }];

      const negRes = await invokeApp('POST', '/api/payments', {
        body: { bookingId: bId, amount: -10000, method: 'nequi' }
      });
      expect(negRes.status).toBe(400);

      const zeroRes = await invokeApp('POST', '/api/payments', {
        body: { bookingId: bId, amount: 0, method: 'nequi' }
      });
      expect(zeroRes.status).toBe(400);

      const okRes = await invokeApp('POST', '/api/payments', {
        body: {
          bookingId: bId,
          amount: 20000,
          method: 'nequi',
          paperPhotosSummary: '<script>evil()</script>2 fotos 10x15'
        }
      });
      expect(okRes.status).toBe(201);
      expect(okRes.body.payment.paperPhotosSummary).not.toContain('<script>');
    });

    it('POST /api/admin/wallets valida montos, POST /api/admin/sessions/:id/deliver valida finalPhotos y rechaza contraseñas débiles', async () => {
      const adminToken = createAdminToken({ pwd: 1 });

      const badWallet = await invokeApp('POST', '/api/admin/wallets', {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { nequi: -500 }
      });
      expect(badWallet.status).toBe(400);

      const tok = 'sess-deliver-svg-' + Date.now();
      runtimeDB.sessions = [{ id: 's-del-1', token: tok, clientName: 'Cliente', status: 'submitted', photos: [] }];
      const badDeliver = await invokeApp('POST', `/api/admin/sessions/${tok}/deliver`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { finalPhotos: [{ url: 'https://evil.com/xss.svg?v=1' }] }
      });
      expect(badDeliver.status).toBe(400);

      expect(isForbiddenWeakPassword('12345678')).toBe(true);
      expect(isForbiddenWeakPassword('aaaaaaaa')).toBe(true);
      expect(isForbiddenWeakPassword('MiClaveSegura#2026')).toBe(false);

      const weakPinChange = await invokeApp('POST', '/api/admin/pin/change', {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { currentPin: 'cualquiera', newPin: '12345678' }
      });
      expect(weakPinChange.status).toBe(400);

      // Emergency reset rechaza contraseña débil y exige MongoDB en producción
      const prevTok = process.env.ADMIN_EMERGENCY_RESET_TOKEN;
      try {
        process.env.ADMIN_EMERGENCY_RESET_TOKEN = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
        let st = 200;
        await handleEmergencyPasswordReset(
          { headers: {}, socket: { remoteAddress: '198.51.100.120' }, body: { token: process.env.ADMIN_EMERGENCY_RESET_TOKEN, newPassword: 'aaaaaaaa' } },
          { status(c) { st = c; return this; }, json() { return this; } },
          { runtimeDB }
        );
        expect(st).toBe(400);
      } finally {
        if (prevTok !== undefined) process.env.ADMIN_EMERGENCY_RESET_TOKEN = prevTok;
        else delete process.env.ADMIN_EMERGENCY_RESET_TOKEN;
      }
    });

    it('soporta rotación con ADMIN_AUTH_SECRET_V2 sin V1 y sanitiza cantidades infinitas o recargo 0 en shared/pricing.js', () => {
      const prevPrimary = process.env.ADMIN_AUTH_SECRET;
      const prevV1 = process.env.ADMIN_AUTH_SECRET_V1;
      const prevV2 = process.env.ADMIN_AUTH_SECRET_V2;
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.ADMIN_AUTH_SECRET;
        delete process.env.ADMIN_AUTH_SECRET_V1;
        process.env.ADMIN_AUTH_SECRET_V2 = 'rotated-secret-v2-min-32-chars-production-2026';
        expect(getAdminAuthSecret()).toBe('rotated-secret-v2-min-32-chars-production-2026');
      } finally {
        process.env.NODE_ENV = prevEnv;
        if (prevPrimary !== undefined) process.env.ADMIN_AUTH_SECRET = prevPrimary;
        if (prevV1 !== undefined) process.env.ADMIN_AUTH_SECRET_V1 = prevV1;
        if (prevV2 !== undefined) process.env.ADMIN_AUTH_SECRET_V2 = prevV2;
        else delete process.env.ADMIN_AUTH_SECRET_V2;
      }

      const zeroSurchargeBand = calculateBookingPriceBand({
        packagePrice: 45000,
        locationType: 'outside',
        surcharge: 0,
        printedSizes: { '10x15': Infinity, '15x20': -3, '20x30': 2.9 }
      });
      expect(zeroSurchargeBand.surchargeApplied).toBe(0);
      expect(zeroSurchargeBand.paperTotal).toBe(0);
      expect(zeroSurchargeBand.retabloTotal).toBe(60000); // floor(2.9) = 2 * 30.000
    });
  });

  describe('4. Auditoría de App Android, Desktop Electron y Frontend', () => {
    it('elimina el APK legado sin endurecer de public/ y verifica compilabilidad/seguridad en android/', () => {
      const rootDir = process.cwd();
      const publicFiles = fs.readdirSync(path.join(rootDir, 'public'));
      expect(publicFiles.some(f => f.toLowerCase().endsWith('.apk'))).toBe(false);

      const tokenStorage = fs.readFileSync(
        path.join(rootDir, 'android/app/src/main/java/app/sebastiang/studio/security/SecureTokenStorage.kt'),
        'utf8'
      );
      expect(tokenStorage).toContain('fun hasDeviceToken(): Boolean');

      const manifest = fs.readFileSync(path.join(rootDir, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
      expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
      expect(manifest).toContain('android:fullBackupContent="@xml/backup_rules"');
      expect(fs.existsSync(path.join(rootDir, 'android/app/src/main/res/xml/data_extraction_rules.xml'))).toBe(true);
      expect(fs.existsSync(path.join(rootDir, 'android/app/src/main/res/xml/backup_rules.xml'))).toBe(true);

      const mainActivity = fs.readFileSync(
        path.join(rootDir, 'android/app/src/main/java/app/sebastiang/studio/MainActivity.kt'),
        'utf8'
      );
      expect(mainActivity).toContain('onReceivedSslError');
      expect(mainActivity).toContain('handler?.cancel()');
      expect(mainActivity).toContain('onShowFileChooser');
      expect(mainActivity).toContain('onBackPressedDispatcher');
      expect(mainActivity).toContain('connection?.disconnect()');

      const bridge = fs.readFileSync(
        path.join(rootDir, 'android/app/src/main/java/app/sebastiang/studio/bridge/AndroidNotificationBridge.kt'),
        'utf8'
      );
      expect(bridge).toContain('KeyPermanentlyInvalidatedException');
      expect(bridge).toContain('JSONObject.quote');
      expect(bridge).toContain('fun downloadPdfFile(base64Data: String, fileName: String)');
      expect(bridge).toContain('fun printPdfDocument(base64Data: String, jobName: String)');
      expect(bridge).toContain('fun testNativeNotification()');

      const proguard = fs.readFileSync(path.join(rootDir, 'android/app/proguard-rules.pro'), 'utf8');
      expect(proguard).toContain('-keepattributes JavascriptInterface');
    });

    it('verifica endurecimiento de permisos, webview y ventanas hijas en electron/main.cjs', () => {
      const electronMain = fs.readFileSync(path.join(process.cwd(), 'electron/main.cjs'), 'utf8');
      expect(electronMain).toContain('setPermissionRequestHandler');
      expect(electronMain).toContain('setPermissionCheckHandler');
      expect(electronMain).toContain('web-contents-created');
      expect(electronMain).toContain('will-attach-webview');
      expect(electronMain).toContain('overrideBrowserWindowOptions');
      expect(electronMain).toContain('checkout.wompi.co');
    });

    it('verifica limpieza de PII, noopener en window.open, OneSignal login y corrección de bugs críticos en src/', () => {
      const rootDir = process.cwd();
      const apiJs = fs.readFileSync(path.join(rootDir, 'src/services/api.js'), 'utf8');
      expect(apiJs).not.toContain('getAdminToken()');
      expect(apiJs).not.toContain('laura-vanesa-maza');
      expect(apiJs).not.toContain('jennifer-vasquez');
      expect(apiJs).not.toContain('Camila Rodríguez');
      expect(apiJs).toContain('{ ...DEFAULT_SETTINGS, ...(localSt || {}), ...data }');

      const bookingModal = fs.readFileSync(path.join(rootDir, 'src/components/BookingModal.jsx'), 'utf8');
      expect(bookingModal).toContain('result.success === false');
      expect(bookingModal).toContain('description: (formData.description || \'\').trim()');

      const oneSignalJs = fs.readFileSync(path.join(rootDir, 'src/services/onesignal.js'), 'utf8');
      expect(oneSignalJs).toContain('OneSignal.login(');
      expect(oneSignalJs).toContain("OneSignal.User.addTag('role', 'admin')");

      const adminPanel = fs.readFileSync(path.join(rootDir, 'src/components/AdminPanel.jsx'), 'utf8');
      expect(adminPanel).not.toContain('la base de datos Supabase');

      // Ningún window.open(..., '_blank') sin noopener,noreferrer en src/
      function walkSrc(dir) {
        let out = [];
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory() && e.name !== '__tests__') out.push(...walkSrc(p));
          else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
        }
        return out;
      }
      for (const file of walkSrc(path.join(rootDir, 'src'))) {
        const content = fs.readFileSync(file, 'utf8');
        const matches = content.match(/window\.open\([^)]*'_blank'\s*\)/g);
        expect(matches, `window.open sin noopener en ${path.relative(rootDir, file)}`).toBeNull();
      }
    });
  });

  describe('5. Barrido Red-Team Fase 2 (CSRF Logout, Validación Reservas/Checkout/Emails/Push y SW)', () => {
    it('POST /api/bookings rechaza nombre vacío/corto, WhatsApp inválido y correo malformado', async () => {
      const badContact = await invokeApp('POST', '/api/bookings', {
        body: {
          clientName: 'A',
          clientWhatsApp: '123',
          packageId: 'pkg-4fotos',
          locationType: 'san_antero',
          dateTime: '29/12/2026 a las 4:00 p. m.',
          totalPrice: 40000
        }
      });
      expect(badContact.status).toBe(400);
      expect(badContact.body.code).toBe('INVALID_BOOKING_CONTACT');

      const badEmail = await invokeApp('POST', '/api/bookings', {
        body: {
          clientName: 'Cliente Valido',
          clientWhatsApp: '+573155551133',
          clientEmail: 'no-es-un-correo',
          packageId: 'pkg-4fotos',
          locationType: 'san_antero',
          dateTime: '29/12/2026 a las 5:00 p. m.',
          totalPrice: 40000
        }
      });
      expect(badEmail.status).toBe(400);
      expect(badEmail.body.code).toBe('INVALID_BOOKING_EMAIL');
    });

    it('POST /api/payments/checkout bloquea reservas canceladas, sesiones revocadas y montos fraccionarios', async () => {
      const bCancId = 'book-canc-chk-' + Date.now();
      const sRevTok = 'sess-rev-chk-' + Date.now();
      const sValidTok = 'sess-frac-chk-' + Date.now();
      runtimeDB.bookings = [{ id: bCancId, clientName: 'Cancelado', status: 'cancelled', totalPrice: 75000 }];
      runtimeDB.sessions = [
        { id: 'sr-1', token: sRevTok, clientName: 'Revocado', status: 'revoked', revoked: true, totalPrice: 75000 },
        { id: 'sv-1', token: sValidTok, clientName: 'Valido', status: 'pending', totalPrice: 75000 }
      ];

      const resCanc = await invokeApp('POST', '/api/payments/checkout', {
        body: { bookingId: bCancId, concept: 'booking_deposit', amount: 20000 }
      });
      expect(resCanc.status).toBe(400);
      expect(resCanc.body.code).toBe('BOOKING_CANCELLED');

      const resRev = await invokeApp('POST', '/api/payments/checkout', {
        body: { sessionToken: sRevTok, concept: 'session_balance', amount: 55000 }
      });
      expect(resRev.status).toBe(403);
      expect(resRev.body.code).toBe('SESSION_REVOKED');

      const resFrac = await invokeApp('POST', '/api/payments/checkout', {
        body: { sessionToken: sValidTok, concept: 'session_balance', amount: 75000.5 }
      });
      expect(resFrac.status).toBe(400);
    });

    it('POST /api/send-email rechaza payloads sin booking con 400 y jamás permite redirigir 2fa_code a targetEmail externo', async () => {
      const adminToken = createAdminToken({ pwd: 1 });

      const missingBooking = await invokeApp('POST', '/api/send-email', {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { type: 'booking_confirmation', data: {} }
      });
      expect(missingBooking.status).toBe(400);

      const missingReceiptBooking = await invokeApp('POST', '/api/send-email', {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { type: 'payment_receipt', data: null }
      });
      expect(missingReceiptBooking.status).toBe(400);

      const apiIndexCode = fs.readFileSync(path.join(process.cwd(), 'api/index.js'), 'utf8');
      expect(apiIndexCode).not.toContain('payload.targetEmail');
      expect(apiIndexCode).not.toContain('data.targetEmail');
    });

    it('POST /api/admin/auth/logout exige anti-CSRF en auth por cookie y revoca el JTI del token', async () => {
      const cookieToken = createAdminToken({ pwd: 1 });
      const csrfBlocked = await invokeApp('POST', '/api/admin/auth/logout', {
        headers: {
          Cookie: `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(cookieToken)}`
        }
      });
      expect(csrfBlocked.status).toBe(403);
      expect(csrfBlocked.body.code).toBe('CSRF_PROTECTION_REQUIRED');

      const logoutOk = await invokeApp('POST', '/api/admin/auth/logout', {
        headers: {
          Cookie: `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(cookieToken)}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      expect(logoutOk.status).toBe(200);
      expect(logoutOk.body.revoked).toBe(true);

      // Tras revocar el JTI, el mismo token ya no puede autenticarse
      const afterRevoke = await invokeApp('GET', '/api/admin/health', {
        headers: { Authorization: `Bearer ${cookieToken}` }
      });
      expect(afterRevoke.status).toBe(401);
    });

    it('POST /api/send-push restringe URLs al dominio oficial, SW no cachea rutas privadas y AdminPanel usa logoutAdminSession', async () => {
      const rootDir = process.cwd();
      const apiIndexCode = fs.readFileSync(path.join(rootDir, 'api/index.js'), 'utf8');
      expect(apiIndexCode).toContain("parsed.protocol === 'https:' && (parsed.hostname === 'sebastiang.app' || parsed.hostname === 'www.sebastiang.app')");

      const swJs = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');
      expect(swJs).toContain("url.pathname.startsWith('/admin')");
      expect(swJs).toContain("url.pathname.startsWith('/galeria')");
      expect(swJs).toContain("url.searchParams.get('mode') === 'admin'");
      expect(swJs).toContain("parsed.protocol === 'https:'");

      const adminPanel = fs.readFileSync(path.join(rootDir, 'src/components/AdminPanel.jsx'), 'utf8');
      expect(adminPanel).toContain('logoutAdminSession');
      expect(adminPanel).toContain('await logoutAdminSession()');

      const bookingModal = fs.readFileSync(path.join(rootDir, 'src/components/BookingModal.jsx'), 'utf8');
      expect(bookingModal).toContain("parsedCheckout.hostname === 'checkout.wompi.co'");
    });
  });
});
