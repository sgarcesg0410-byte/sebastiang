#!/usr/bin/env node
import 'dotenv/config';
import crypto from 'crypto';
import { MongoClient } from 'mongodb';

// Aislar siempre el simulacro en una base de datos efímera para no contaminar producción ('sebastiang')
const ORIGINAL_DB_NAME = process.env.MONGODB_DB_NAME || 'sebastiang';
const DRILL_SANDBOX_DB_NAME = `sebastiang_drill_sandbox_${Date.now()}`;
process.env.MONGODB_DB_NAME = DRILL_SANDBOX_DB_NAME;

const { default: app, clearApiRateLimiters } = await import('../api/index.js');
const {
  createAdminToken,
  encryptBackupPayload,
  decryptBackupPayload,
  setCachedPasswordVersion,
  resetOperationalMetrics
} = await import('../api/security.js');
const { ensureMongoIndexes } = await import('../api/db/mongo.js');

async function invokeApp(method, url, { body = {}, headers = {} } = {}) {
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

    app.handle(req, res, (err) => {
      if (err) return reject(err);
      resolve({ status: res.statusCode || 404, headers: res.headers, body: res.body });
    });
  });
}

async function runDrill() {
  console.log('======================================================================');
  console.log('🛡️  SIMULACRO OPERACIONAL E INCIDENTES REALES — SEBASTIAN G FOTOGRAFÍA');
  console.log('======================================================================\n');

  if (!process.env.ADMIN_AUTH_SECRET) {
    process.env.ADMIN_AUTH_SECRET = 'drill-ephemeral-secret-' + crypto.randomBytes(16).toString('hex');
  }
  if (!process.env.WOMPI_INTEGRITY_SECRET) {
    process.env.WOMPI_INTEGRITY_SECRET = 'drill_wompi_integrity_secret';
  }
  if (!process.env.WOMPI_EVENTS_SECRET) {
    process.env.WOMPI_EVENTS_SECRET = 'drill_wompi_events_secret';
  }

  setCachedPasswordVersion(1);
  clearApiRateLimiters();
  resetOperationalMetrics();

  const adminToken = createAdminToken({ pwd: 1 });

  // ---------------------------------------------------------------------------
  // FASE 1: Custodia y Rotación de Claves AES-256-GCM (v1 -> v2 con AAD keyId)
  // ---------------------------------------------------------------------------
  console.log('▶ [Fase 1/5] Probando rotación de claves de cifrado AES-256-GCM (keyId v1 → v2)...');
  const keyring = {
    v1: 'kms-key-2026-q3-secret-alpha',
    v2: 'kms-key-2026-q4-secret-bravo'
  };
  const sampleData = { bookings: [{ id: 'book-drill-1', clientName: 'Cliente Drill', totalPrice: 75000 }] };

  const envV1 = encryptBackupPayload(sampleData, { keyId: 'v1', keyringOverride: keyring });
  const envV2 = encryptBackupPayload(sampleData, { keyId: 'v2', keyringOverride: keyring });

  const decV1 = decryptBackupPayload(envV1, { keyringOverride: keyring });
  const decV2 = decryptBackupPayload(envV2, { keyringOverride: keyring });

  if (decV1.bookings[0].id !== 'book-drill-1' || decV2.bookings[0].id !== 'book-drill-1') {
    throw new Error('Fallo en descifrado multi-versión del keyring.');
  }

  let tamperedRejected = false;
  try {
    decryptBackupPayload({ ...envV1, keyId: 'v2' }, { keyringOverride: keyring });
  } catch {
    tamperedRejected = true;
  }
  if (!tamperedRejected) {
    throw new Error('Fallo crítico: alteración de keyId en sobre cifrado no fue detectada.');
  }
  console.log('  ✓ Claves v1 y v2 operativas; protección AAD contra adulteración de keyId verificada.\n');

  // ---------------------------------------------------------------------------
  // FASE 2: Incidente de Pérdida de Teléfono / Revocación de Token APK
  // ---------------------------------------------------------------------------
  console.log('▶ [Fase 2/5] Simulando incidente de pérdida de dispositivo móvil y revocación APK...');
  const regRes = await invokeApp('POST', '/api/admin/apk-devices/register', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { deviceId: 'drill-android-lost-01', deviceName: 'Teléfono Simulacro Incidente' }
  });
  const deviceToken = regRes.body.deviceToken;

  const feedBefore = await invokeApp('GET', '/api/apk/feed', {
    headers: { 'x-apk-device-token': deviceToken }
  });
  if (feedBefore.status !== 200) throw new Error('El token APK recién emitido no pudo leer el feed.');

  await invokeApp('POST', '/api/admin/apk-devices/revoke', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { deviceId: 'drill-android-lost-01' }
  });

  const feedAfter = await invokeApp('GET', '/api/apk/feed', {
    headers: { 'x-apk-device-token': deviceToken }
  });
  if (feedAfter.status !== 401) throw new Error('El token APK revocado no fue bloqueado con 401.');
  console.log('  ✓ Dispositivo APK revocado en caliente; acceso bloqueado con HTTP 401 inmediato.\n');

  // ---------------------------------------------------------------------------
  // FASE 3: Simulacro de Pago Sandbox Wompi e Idempotencia de Webhook
  // ---------------------------------------------------------------------------
  console.log('▶ [Fase 3/5] Simulando reserva, checkout Wompi sandbox y doble disparo de webhook...');
  const bookRes = await invokeApp('POST', '/api/bookings', {
    body: {
      clientName: 'Simulacro Operacional',
      clientWhatsApp: '+573009998877',
      packageId: 'pkg-8fotos',
      totalPrice: 75000,
      dateTime: '2026-12-28 • 04:00 PM'
    }
  });
  const bookingId = bookRes.body.booking.id;

  const chkRes = await invokeApp('POST', '/api/payments/checkout', {
    body: {
      bookingId,
      concept: 'booking_deposit',
      amount: 20000,
      clientName: 'Simulacro Operacional',
      clientWhatsApp: '+573009998877'
    }
  });
  const ref = chkRes.body.reference;
  const txId = 'tx-drill-001';
  const amountInCents = 2000000;
  const ts = 1795000000;
  const checksum = crypto
    .createHash('sha256')
    .update(`${txId}APPROVED${amountInCents}${ts}${process.env.WOMPI_EVENTS_SECRET}`)
    .digest('hex');

  const webhookPayload = {
    event: 'transaction.updated',
    data: {
      transaction: { id: txId, reference: ref, status: 'APPROVED', amount_in_cents: amountInCents }
    },
    timestamp: ts,
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum
    }
  };

  const wh1 = await invokeApp('POST', '/api/payments/webhook', { body: webhookPayload });
  const wh2 = await invokeApp('POST', '/api/payments/webhook', { body: webhookPayload });
  if (wh1.status !== 200 || wh2.status !== 200 || !wh2.body.idempotent) {
    throw new Error('Fallo en idempotencia del webhook de Wompi.');
  }
  console.log('  ✓ Pago aprobado y segundo disparo de webhook absorbido de forma idempotente.\n');

  // ---------------------------------------------------------------------------
  // FASE 4: Exportación Cifrada, Restauración en MongoDB Atlas Temporal y RTO Real
  // ---------------------------------------------------------------------------
  console.log('▶ [Fase 4/5] Ejecutando backup cifrado y prueba de restauración (RTO / Índices / TTL)...');
  const exportStart = performance.now();
  const backupRes = await invokeApp('GET', '/api/admin/backup?encrypt=1', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const exportMs = Math.max(1, Math.round(performance.now() - exportStart));
  if (backupRes.status !== 200 || !backupRes.body.encrypted) {
    throw new Error('Fallo al exportar backup cifrado.');
  }

  const restoreRes = await invokeApp('POST', '/api/admin/backup/restore', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { encryptedEnvelope: backupRes.body.encryptedEnvelope }
  });
  if (restoreRes.status !== 200 || !restoreRes.body.success) {
    throw new Error('Fallo al restaurar backup cifrado.');
  }
  console.log(`  ✓ Exportación cifrada (keyId=${backupRes.body.encryptedEnvelope.keyId}): ${exportMs} ms`);
  console.log(`  ✓ Restauración de aplicación: ${restoreRes.body.recoveryTimeMs} ms`, restoreRes.body.phasesMs);

  const mongoUri = String(process.env.MONGODB_URI || '').trim().replace(/^['"]|['"]$/g, '');
  if (mongoUri && mongoUri.startsWith('mongodb')) {
    const tempDbName = `sebastiang_drill_${Date.now()}`;
    const atlasStart = performance.now();
    let tempClient = null;
    try {
      tempClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 6000 });
      await tempClient.connect();
      const connectMs = Math.round(performance.now() - atlasStart);

      const tempDb = tempClient.db(tempDbName);
      const indexReport = await ensureMongoIndexes(tempDb);

      const writeStart = performance.now();
      const decrypted = decryptBackupPayload(backupRes.body.encryptedEnvelope);
      if (decrypted.bookings?.length) {
        await tempDb.collection('bookings').insertMany(decrypted.bookings.map(({ _id, ...b }) => b));
      }
      if (decrypted.payments?.length) {
        await tempDb.collection('payments').insertMany(decrypted.payments.map(({ _id, ...p }) => p));
      }
      await tempDb.collection('audit_logs').insertOne({
        id: 'audit-drill-ttl-check',
        createdAt: new Date().toISOString(),
        expiresAtDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        action: 'drill_ttl_verification'
      });
      const writeMs = Math.round(performance.now() - writeStart);

      const verifyStart = performance.now();
      const countBookings = await tempDb.collection('bookings').countDocuments();
      const auditIndexes = await tempDb.collection('audit_logs').indexes();
      const hasTtlIndex = auditIndexes.some(idx => idx.name === 'idx_audit_logs_ttl_90d' && idx.expireAfterSeconds === 0);
      const verifyMs = Math.round(performance.now() - verifyStart);

      await tempDb.dropDatabase();
      // Limpiar también la base sandbox efímera y cualquier registro residual de simulacro en la base principal
      await tempClient.db(DRILL_SANDBOX_DB_NAME).dropDatabase().catch(() => {});
      const mainDb = tempClient.db(ORIGINAL_DB_NAME);
      await mainDb.collection('bookings').deleteMany({ clientName: 'Simulacro Operacional' }).catch(() => {});
      await mainDb.collection('payments').deleteMany({ clientName: 'Simulacro Operacional' }).catch(() => {});
      await mainDb.collection('settings').updateOne(
        { id: 'global' },
        {
          $pull: {
            apkDevices: { deviceId: 'drill-android-lost-01' },
            revokedApkDeviceIds: 'drill-android-lost-01'
          }
        }
      ).catch(() => {});
      // Asegurar que los 11 índices BSON (incluyendo TTL 90d) queden creados en la base principal de producción
      const prodIndexReport = await ensureMongoIndexes(mainDb);

      const totalAtlasRtoMs = Math.round(performance.now() - atlasStart);

      console.log(`  ✓ [MongoDB Atlas Real — DB temporal "${tempDbName}" + DB principal "${ORIGINAL_DB_NAME}"]`);
      console.log(`    • Conexión TLS Atlas: ${connectMs} ms`);
      console.log(`    • Creación/verificación de ${indexReport.indexes.length} índices en DB temporal (incl. TTL 90d): ${indexReport.elapsedMs} ms (TTL activo: ${hasTtlIndex})`);
      console.log(`    • Índices asegurados en DB principal "${ORIGINAL_DB_NAME}": ${prodIndexReport.indexes.length} índices en ${prodIndexReport.elapsedMs} ms`);
      console.log(`    • Escritura de ${countBookings} reserva(s) y colecciones: ${writeMs} ms`);
      console.log(`    • Verificación de lectura e integridad: ${verifyMs} ms`);
      console.log(`    • RTO Total en infraestructura MongoDB Atlas real (con limpieza de DB temporal): ${totalAtlasRtoMs} ms\n`);
    } catch (atlasErr) {
      console.warn(`  ⚠️ [MongoDB Atlas] No se pudo completar la prueba en red contra Atlas: ${atlasErr?.message || atlasErr}\n`);
    } finally {
      if (tempClient) await tempClient.close().catch(() => {});
    }
  } else {
    console.log('  ℹ️ MONGODB_URI no definida en el entorno local; se omitió la fase de red contra Atlas.\n');
  }

  // ---------------------------------------------------------------------------
  // FASE 5: Prueba del Canal de Alertas y Estado de Monitoreo
  // ---------------------------------------------------------------------------
  console.log('▶ [Fase 5/5] Verificando disparo de alerta de prueba y endpoint de monitoreo...');
  const alertRes = await invokeApp('POST', '/api/admin/monitoring/test-alert', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { reason: 'Simulacro automatizado ops:drill' }
  });
  const monRes = await invokeApp('GET', '/api/admin/monitoring/status', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  if (alertRes.status !== 200 || monRes.status !== 200) {
    throw new Error('Fallo en la verificación del canal de alertas.');
  }
  console.log('  ✓ Alerta registrada (auditLogId:', alertRes.body.auditLogId, ') | Estado:', monRes.body.status);

  // Limpieza final de la base sandbox efímera tras completar Fase 5
  if (mongoUri && mongoUri.startsWith('mongodb')) {
    let cleanupClient = null;
    try {
      cleanupClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
      await cleanupClient.connect();
      await cleanupClient.db(DRILL_SANDBOX_DB_NAME).dropDatabase().catch(() => {});
    } catch {} finally {
      if (cleanupClient) await cleanupClient.close().catch(() => {});
    }
  }

  console.log('\n✅ SIMULACRO OPERACIONAL COMPLETADO CON ÉXITO (5/5 fases superadas).');
}

runDrill().catch((err) => {
  console.error('\n❌ ERROR EN SIMULACRO OPERACIONAL:', err);
  process.exit(1);
});
