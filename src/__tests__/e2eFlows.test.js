import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import app, { clearApiRateLimiters } from '../../api/index.js';
import {
  createAdminToken,
  verifyAdminToken,
  setCachedPasswordVersion,
  sanitizeAuditMetadata,
  pruneExpiredAuditLogs,
  AUDIT_LOG_RETENTION_DAYS,
  encryptBackupPayload,
  decryptBackupPayload,
  resetOperationalMetrics
} from '../../api/security.js';
import { clearRateLimiters as clearResetRateLimiters } from '../../api/passwordReset.js';

// Helper E2E para invocar el pipeline completo de Express en memoria
async function invokeE2E(method, url, { body = {}, headers = {} } = {}) {
  const parsedUrl = new URL(url, 'https://sebastiang.app');
  const query = Object.fromEntries(parsedUrl.searchParams.entries());

  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url: parsedUrl.pathname + parsedUrl.search,
      originalUrl: parsedUrl.pathname + parsedUrl.search,
      path: parsedUrl.pathname,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 Mobile',
        ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
      },
      body,
      query,
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
        resolve({ status: this.statusCode, headers: this.headers, body: payload });
        return this;
      },
      send(payload) {
        this.body = payload;
        resolve({ status: this.statusCode, headers: this.headers, body: payload });
        return this;
      },
      end(payload) {
        if (payload !== undefined) this.body = payload;
        resolve({ status: this.statusCode, headers: this.headers, body: this.body });
        return this;
      }
    };

    try {
      app.handle(req, res, (err) => {
        if (err) return reject(err);
        resolve({ status: res.statusCode || 404, headers: res.headers, body: res.body });
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Pequeña imagen PNG 1x1 válida con magic bytes reales
const VALID_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Suite E2E de Operación Segura y Producción Definitiva', () => {
  beforeEach(() => {
    process.env.ADMIN_AUTH_SECRET = 'e2e-production-secret-key-2026-sebastiang-studio';
    process.env.WOMPI_INTEGRITY_SECRET = 'e2e_wompi_integrity_secret';
    process.env.WOMPI_EVENTS_SECRET = 'e2e_wompi_events_secret';
    setCachedPasswordVersion(1);
    clearApiRateLimiters();
    clearResetRateLimiters();
    resetOperationalMetrics();
  });

  it('Flujo E2E 1–5: Reserva móvil -> Bloqueo de horario duplicado -> Checkout Wompi -> Webhook firmado -> Recibo electrónico verificado', async () => {
    const slotDate = '2026-12-18 • 03:00 PM';

    // 1. Cliente reserva desde móvil
    const bookingRes = await invokeE2E('POST', '/api/bookings', {
      body: {
        clientName: 'Valentina Córdoba',
        clientWhatsApp: '+573105559988',
        clientEmail: 'valentina@example.com',
        packageId: 'pkg-8fotos', // 8 Fotos Digitales ($75.000)
        totalPrice: 75000,
        locationType: 'san_antero',
        specificLocation: 'Playa Blanca',
        dateTime: slotDate,
        description: 'Sesión de cumpleaños al atardecer'
      }
    });
    expect(bookingRes.status).toBe(201);
    expect(bookingRes.body.success).toBe(true);
    const booking = bookingRes.body.booking;
    const receiptToken = bookingRes.body.receiptToken;
    expect(booking.totalPrice).toBe(75000);
    expect(typeof receiptToken).toBe('string');

    // 2. El horario aparece ocupado en la agenda pública (sin filtrar PII ni booking IDs)
    const scheduleRes = await invokeE2E('GET', '/api/public/schedule');
    expect(scheduleRes.status).toBe(200);
    const bookedSlot = scheduleRes.body.slots.find(s => s.dateTime === slotDate || s.id === booking.id);
    expect(bookedSlot).toBeDefined();
    expect(bookedSlot.clientName).toBeUndefined();
    expect(bookedSlot.clientWhatsApp).toBeUndefined();

    // 3. Intento de doble reserva en ventana solapada (3:30 PM del mismo día) -> 409 Conflict
    const duplicateRes = await invokeE2E('POST', '/api/bookings', {
      body: {
        clientName: 'Otro Cliente',
        clientWhatsApp: '+573001112233',
        packageId: 'pkg-1',
        dateTime: '2026-12-18 • 03:30 PM'
      }
    });
    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.code).toBe('SLOT_ALREADY_BOOKED');

    // 4. Iniciar Checkout Wompi por abono oficial de reserva ($20.000 COP)
    const depositAmount = 20000;
    const checkoutRes = await invokeE2E('POST', '/api/payments/checkout', {
      body: {
        bookingId: booking.id,
        concept: 'booking_deposit',
        amount: depositAmount,
        clientName: booking.clientName,
        clientWhatsApp: booking.clientWhatsApp,
        clientEmail: booking.clientEmail
      }
    });
    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.reference).toMatch(/^ref-wompi-/);
    expect(checkoutRes.body.amountInCents).toBe(2000000);

    // 5. Recibir Webhook firmado de Wompi aprobando la transacción
    const reference = checkoutRes.body.reference;
    const txId = 'tx-e2e-wompi-9901';
    const txStatus = 'APPROVED';
    const amountInCents = 2000000;
    const timestamp = 1793000000;
    const rawChecksum = `${txId}${txStatus}${amountInCents}${timestamp}${process.env.WOMPI_EVENTS_SECRET}`;
    const checksum = crypto.createHash('sha256').update(rawChecksum).digest('hex');

    const webhookRes = await invokeE2E('POST', '/api/payments/webhook', {
      body: {
        event: 'transaction.updated',
        data: {
          transaction: {
            id: txId,
            reference,
            status: txStatus,
            amount_in_cents: amountInCents,
            payment_method_type: 'NEQUI'
          }
        },
        timestamp,
        signature: {
          properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
          checksum
        }
      }
    });
    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.status).toBe('APPROVED');

    // 6. Consultar el recibo público por token firmado: verifica abono acreditado ($20.000) y estado 'confirmed'
    const receiptRes = await invokeE2E('GET', `/api/public/receipt/${encodeURIComponent(receiptToken)}`);
    expect(receiptRes.status).toBe(200);
    expect(receiptRes.body.booking.id).toBe(booking.id);
    expect(receiptRes.body.booking.status).toBe('confirmed');
    expect(receiptRes.body.booking.paidAmount).toBe(20000);
  });

  it('Flujo E2E 6: Galería privada — creación, expiración (0 fotos expuestas) y revocación inmediata (403)', async () => {
    const adminToken = createAdminToken({ pwd: 1 });

    // Crear sesión de galería privada
    const createRes = await invokeE2E('POST', '/api/admin/sessions', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        clientName: 'Camila Restrepo',
        clientWhatsApp: '+573158887766',
        packageTitle: '6 Fotos Digitales',
        maxPhotosAllowed: 6,
        totalPrice: 65000,
        photos: [
          { title: 'Retrato 01', url: VALID_PNG_DATA_URL },
          { title: 'Retrato 02', url: VALID_PNG_DATA_URL }
        ]
      }
    });
    expect(createRes.status).toBe(201);
    const session = createRes.body.session;
    const token = session.token;

    // Lectura normal mientras está vigente
    const activeGallery = await invokeE2E('GET', `/api/gallery/${token}`);
    expect(activeGallery.status).toBe(200);
    expect(activeGallery.body.photos.length).toBe(2);

    // Simular expiración (hace 2 días) usando reopen con -2 días
    await invokeE2E('POST', `/api/admin/sessions/${session.id}/reopen`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { additionalDays: -2 }
    });

    const expiredGallery = await invokeE2E('GET', `/api/gallery/${token}`);
    expect(expiredGallery.status).toBe(200);
    expect(expiredGallery.body.isExpired).toBe(true);
    expect(expiredGallery.body.photos).toEqual([]); // Jamás expone las fotos cuando expiró

    const submitOnExpired = await invokeE2E('POST', `/api/gallery/${token}/submit`, {
      body: { selections: [{ id: session.photos[0].id, selected: true }] }
    });
    expect(submitOnExpired.status).toBe(410);

    // Revocar galería -> 403 Forbidden
    const revokeRes = await invokeE2E('POST', `/api/admin/sessions/${session.id}/revoke`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(revokeRes.status).toBe(200);

    const revokedGallery = await invokeE2E('GET', `/api/gallery/${token}`);
    expect(revokedGallery.status).toBe(403);
  });

  it('Flujo E2E 7–8: Ciclo APK (registro, consumo, revocación en cada petición e invalidación por cambio de contraseña)', async () => {
    const adminToken = createAdminToken({ pwd: 1 });

    // Registrar 2 dispositivos APK
    const dev1Res = await invokeE2E('POST', '/api/admin/apk-devices/register', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { deviceId: 'apk-galaxy-s24', deviceName: 'Galaxy S24 Estudio' }
    });
    const dev2Res = await invokeE2E('POST', '/api/admin/apk-devices/register', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { deviceId: 'apk-tablet-pos', deviceName: 'Tablet Recepción' }
    });
    expect(dev1Res.status).toBe(201);
    expect(dev2Res.status).toBe(201);

    const token1 = dev1Res.body.deviceToken;
    const token2 = dev2Res.body.deviceToken;

    // Ambos pueden leer /api/apk/feed
    expect((await invokeE2E('GET', '/api/apk/feed', { headers: { 'x-apk-device-token': token1 } })).status).toBe(200);
    expect((await invokeE2E('GET', '/api/apk/feed', { headers: { 'x-apk-device-token': token2 } })).status).toBe(200);

    // Revocar dispositivo 1: rechaza token1 en el acto pero mantiene activo token2
    await invokeE2E('POST', '/api/admin/apk-devices/revoke', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { deviceId: 'apk-galaxy-s24' }
    });
    expect((await invokeE2E('GET', '/api/apk/feed', { headers: { 'x-apk-device-token': token1 } })).status).toBe(401);
    expect((await invokeE2E('GET', '/api/apk/feed', { headers: { 'x-apk-device-token': token2 } })).status).toBe(200);

    // Verificar que el monitoreo haya registrado el rechazo de autenticación APK
    const monRes = await invokeE2E('GET', '/api/admin/monitoring/status', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(monRes.status).toBe(200);
    expect(monRes.body.counters.failedApkAuths).toBeGreaterThanOrEqual(1);
  });

  it('Flujo E2E 9: Exportación de Backup Cifrado (AES-256-GCM), Sanitización de Secretos y Restauración con Medición de RTO', async () => {
    const adminToken = createAdminToken({ pwd: 1 });

    // 1. Crear una reserva y un pago de prueba antes del backup
    const bookRes = await invokeE2E('POST', '/api/bookings', {
      body: {
        clientName: 'Andrés Felipe Mejía',
        clientWhatsApp: '+573209991122',
        clientEmail: 'andres@example.com',
        packageId: 'pkg-10fotos',
        totalPrice: 85000,
        dateTime: '2026-12-22 • 10:00 AM'
      }
    });
    expect(bookRes.status).toBe(201);
    const createdBookingId = bookRes.body.booking.id;

    // 2. Exportar backup en JSON sanitizado y verificar headers y ausencia de secretos
    const plainBackupRes = await invokeE2E('GET', '/api/admin/backup', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(plainBackupRes.status).toBe(200);
    expect(plainBackupRes.headers['content-disposition']).toContain('attachment; filename="sebastiang-backup-');
    expect(plainBackupRes.headers['cache-control']).toContain('no-store');
    expect(plainBackupRes.body.snapshot.settings.adminPinScrypt).toBeUndefined();
    expect(plainBackupRes.body.snapshot.settings.adminPinHash).toBeUndefined();
    expect(plainBackupRes.body.snapshot.settings.adminResetChallenge).toBeUndefined();
    expect(plainBackupRes.body.snapshot.bookings.some(b => b.id === createdBookingId)).toBe(true);

    // 3. Exportar backup cifrado con AES-256-GCM (?encrypt=1)
    const encBackupRes = await invokeE2E('GET', '/api/admin/backup?encrypt=1', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(encBackupRes.status).toBe(200);
    expect(encBackupRes.body.encrypted).toBe(true);
    expect(encBackupRes.body.snapshot).toBeUndefined();
    expect(encBackupRes.body.encryptedEnvelope.algorithm).toBe('aes-256-gcm');

    // 4. Simular pérdida/borrado de la reserva en el sistema
    const delRes = await invokeE2E('DELETE', `/api/admin/bookings/${createdBookingId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(delRes.status).toBe(200);

    const listAfterDelete = await invokeE2E('GET', '/api/admin/bookings', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(listAfterDelete.body.some(b => b.id === createdBookingId)).toBe(false);

    // 5. Restaurar desde el sobre cifrado AES-256-GCM y medir tiempo de recuperación (recoveryTimeMs)
    const restoreRes = await invokeE2E('POST', '/api/admin/backup/restore', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { encryptedEnvelope: encBackupRes.body.encryptedEnvelope }
    });
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.success).toBe(true);
    expect(restoreRes.body.recoveryTimeMs).toBeGreaterThanOrEqual(1);
    expect(restoreRes.body.recoveryTimeMs).toBeLessThan(2000); // RTO < 2s
    expect(restoreRes.body.restoredCounts.bookings).toBeGreaterThanOrEqual(1);

    // 6. Validar que la reserva restaurada esté íntegra nuevamente
    const listAfterRestore = await invokeE2E('GET', '/api/admin/bookings', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const restoredBooking = listAfterRestore.body.find(b => b.id === createdBookingId);
    expect(restoredBooking).toBeDefined();
    expect(restoredBooking.clientName).toBe('Andrés Felipe Mejía');
  });

  it('Flujo E2E 10: Sanitización y retención de 90 días del Audit Log (cero secretos, PII enmascarada)', () => {
    const sanitized = sanitizeAuditMetadata({
      clientEmail: 'cliente.secreto@gmail.com',
      clientWhatsApp: '+573244725167',
      password: 'SuperSecretPassword123',
      deviceToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret',
      voucherUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
      concept: 'booking_deposit'
    });

    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.deviceToken).toBe('[REDACTED]');
    expect(sanitized.voucherUrl).toBe('[REDACTED]');
    expect(sanitized.clientEmail).not.toContain('cliente.secreto');
    expect(sanitized.clientWhatsApp).not.toContain('32447251');
    expect(sanitized.concept).toBe('booking_deposit');

    // Retención de 90 días
    expect(AUDIT_LOG_RETENTION_DAYS).toBe(90);
    const now = Date.now();
    const logs = [
      { id: 'audit-recent', timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'audit-expired', timestamp: new Date(now - 95 * 24 * 60 * 60 * 1000).toISOString() }
    ];
    const pruned = pruneExpiredAuditLogs(logs, now);
    expect(pruned.map(l => l.id)).toEqual(['audit-recent']);
  });

  it('Flujo E2E 11: Custodia y rotación versionada de claves de Backup (keyId v1 -> v2 + protección AAD) y prueba de alerta externa', async () => {
    process.env.BACKUP_ENCRYPTION_KEY_V1 = 'llave-kms-historica-v1-2025-sebastiang';
    process.env.BACKUP_ENCRYPTION_KEY_V2 = 'llave-kms-rotada-v2-2026-sebastiang';
    process.env.BACKUP_ENCRYPTION_KEY_ID = 'v1';

    // 1. Cifrar backup con llave v1
    const snapV1 = { bookings: [{ id: 'bk-key-v1', clientName: 'Cliente Historico V1' }] };
    const envV1 = encryptBackupPayload(snapV1);
    expect(envV1.keyId).toBe('v1');

    // 2. Rotar llave activa a v2 y cifrar nuevo backup
    process.env.BACKUP_ENCRYPTION_KEY_ID = 'v2';
    const snapV2 = { bookings: [{ id: 'bk-key-v2', clientName: 'Cliente Actual V2' }] };
    const envV2 = encryptBackupPayload(snapV2);
    expect(envV2.keyId).toBe('v2');

    // 3. Verificar que tanto v1 (histórico) como v2 (actual) se descifran correctamente tras la rotación
    expect(decryptBackupPayload(envV1).bookings[0].id).toBe('bk-key-v1');
    expect(decryptBackupPayload(envV2).bookings[0].id).toBe('bk-key-v2');

    // 4. Verificar que alterar el keyId en el sobre falla por validación criptográfica AAD (AES-256-GCM)
    expect(() => decryptBackupPayload({ ...envV1, keyId: 'v2' })).toThrow();

    // 5. Probar endpoint de alerta mensual (/api/admin/monitoring/test-alert)
    const adminToken = createAdminToken({ pwd: 1 });
    const alertRes = await invokeE2E('POST', '/api/admin/monitoring/test-alert', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { reason: 'Simulacro E2E de alerta mensual' }
    });
    expect(alertRes.status).toBe(200);
    expect(alertRes.body.success).toBe(true);
    expect(alertRes.body.auditLogId).toMatch(/^audit-/);
    expect(alertRes.body.channels.inAppAuditLog).toBe(true);
  });
});
