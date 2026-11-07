// api/db/mongo.js
// ==============================================================================
// CLIENTE CENTRALIZADO DE MONGODB ATLAS (Conexión reutilizable en Serverless)
// ==============================================================================
// Proporciona conexión persistente con pooling para Vercel Serverless y Node local.
// Si MONGODB_URI no está definida, el sistema opera de forma transparente con sus
// respaldos locales sin arrojar errores fatales.
// ==============================================================================

import crypto from 'crypto';
import { MongoClient, ServerApiVersion } from 'mongodb';

let cachedClient = null;
let cachedDb = null;
let connectingPromise = null;

export function getMongoUri() {
  if ((process.env.NODE_ENV === 'test' || process.env.VITEST) && process.env.ALLOW_MONGO_IN_TESTS !== 'true') {
    return '';
  }
  return (process.env.MONGODB_URI || '').trim().replace(/^['"]|['"]$/g, '');
}

export function getMongoDbName() {
  return (process.env.MONGODB_DB_NAME || 'sebastiang').trim().replace(/^['"]|['"]$/g, '');
}

export function isMongoConfigured() {
  const uri = getMongoUri();
  return Boolean(uri && (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')));
}

export async function getMongoDb() {
  if (!isMongoConfigured()) return null;
  if (cachedDb && cachedClient) return cachedDb;

  if (connectingPromise) {
    return connectingPromise;
  }

  const uri = getMongoUri();
  const dbName = getMongoDbName();
  const timeoutMatch = uri.match(/serverSelectionTimeoutMS=(\d+)/i);
  const timeoutMs = timeoutMatch ? Math.max(100, Number(timeoutMatch[1])) : 6000;

  connectingPromise = (async () => {
    try {
      const client = new MongoClient(uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true
        },
        maxPoolSize: 10,
        minPoolSize: 1,
        serverSelectionTimeoutMS: timeoutMs,
        connectTimeoutMS: timeoutMs
      });

      await client.connect();
      cachedClient = client;
      cachedDb = client.db(dbName);
      console.log(`✅ [MongoDB Atlas] Conectado exitosamente a la base de datos "${dbName}"`);
      return cachedDb;
    } catch (err) {
      console.error('⚠️ [MongoDB Atlas] Error al conectar:', err?.message || err);
      cachedClient = null;
      cachedDb = null;
      return null;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

/**
 * Deduplica de forma segura documentos por un campo clave antes de aplicar un índice único,
 * conservando siempre la versión más reciente.
 */
async function deduplicateCollectionByField(database, collectionName, fieldName) {
  try {
    const col = database.collection(collectionName);
    const duplicates = await col.aggregate([
      { $match: { [fieldName]: { $exists: true, $nin: [null, ''] } } },
      {
        $group: {
          _id: `$${fieldName}`,
          count: { $sum: 1 },
          docs: { $push: { _id: '$_id', updatedAt: '$updatedAt', createdAt: '$createdAt' } }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    for (const group of duplicates) {
      const sorted = [...group.docs].sort((a, b) => {
        const ta = Date.parse(a.updatedAt || a.createdAt || '') || 0;
        const tb = Date.parse(b.updatedAt || b.createdAt || '') || 0;
        return tb - ta;
      });
      const idsToRemove = sorted.slice(1).map(d => d._id);
      if (idsToRemove.length > 0) {
        await col.deleteMany({ _id: { $in: idsToRemove } });
      }
    }
  } catch {
    // Si la colección aún no existe o el agregado no aplica, continuar
  }
}

/**
 * Definición canónica de los 19 índices BSON críticos de producción e índices TTL en MongoDB Atlas:
 * - Unicidad estricta en `bookings.id`, `payments.id`, `payments.reference`, `payments.transactionId`,
 *   `sessions.id`, `sessions.token`, `reviews.id`, `reviews.galleryToken`, `audit_logs.id`, `slot_locks.lockKey` y `rate_limits.key`.
 * - Índice compuesto `{ dateTime: 1, status: 1 }` en `bookings` para detección rápida de cruces de horario.
 * - Índice `{ expiresAt: 1 }` en `sessions` para control de caducidad de galerías privadas.
 * - Índices TTL nativos en `audit_logs` (90 días), `slot_locks` y `rate_limits`.
 */
export const EXPECTED_MONGO_INDEXES = [
  // 1–3. Índices de Reservas (bookings)
  { col: 'bookings', spec: { id: 1 }, opts: { unique: true, name: 'uniq_bookings_id', background: true } },
  { col: 'bookings', spec: { dateTime: 1, status: 1 }, opts: { name: 'idx_bookings_datetime_status', background: true } },
  { col: 'bookings', spec: { createdAt: -1 }, opts: { name: 'idx_bookings_created_desc', background: true } },

  // 4–7. Índices de Pagos y Anti-Replay de Pasarela (payments)
  { col: 'payments', spec: { id: 1 }, opts: { unique: true, name: 'uniq_payments_id', background: true } },
  { col: 'payments', spec: { reference: 1 }, opts: { unique: true, sparse: true, name: 'uniq_payments_reference', background: true } },
  { col: 'payments', spec: { transactionId: 1 }, opts: { unique: true, sparse: true, name: 'uniq_payments_txid', background: true } },
  { col: 'payments', spec: { bookingId: 1 }, opts: { name: 'idx_payments_booking_id', background: true } },

  // 8–10. Índices de Galerías Privadas (sessions)
  { col: 'sessions', spec: { id: 1 }, opts: { unique: true, name: 'uniq_sessions_id', background: true } },
  { col: 'sessions', spec: { token: 1 }, opts: { unique: true, name: 'uniq_sessions_token', background: true } },
  { col: 'sessions', spec: { expiresAt: 1 }, opts: { name: 'idx_sessions_expires_at', background: true } },

  // 11–12. Índices de Reseñas Verificadas y Unicidad por Galería (reviews)
  { col: 'reviews', spec: { id: 1 }, opts: { unique: true, name: 'uniq_reviews_id', background: true } },
  { col: 'reviews', spec: { galleryToken: 1 }, opts: { unique: true, sparse: true, name: 'uniq_reviews_gallery_token', background: true } },

  // 13–15. Índices de Auditoría Financiera + TTL automático de 90 días (audit_logs)
  { col: 'audit_logs', spec: { id: 1 }, opts: { unique: true, name: 'uniq_audit_logs_id', background: true } },
  { col: 'audit_logs', spec: { createdAt: -1 }, opts: { name: 'idx_audit_logs_created_desc', background: true } },
  { col: 'audit_logs', spec: { expiresAtDate: 1 }, opts: { expireAfterSeconds: 0, name: 'idx_audit_logs_ttl_90d', background: true } },

  // 16–17. Índices de Bloqueo Distribuido de Horarios (slot_locks)
  { col: 'slot_locks', spec: { lockKey: 1 }, opts: { unique: true, name: 'uniq_slot_locks_key', background: true } },
  { col: 'slot_locks', spec: { expiresAtDate: 1 }, opts: { expireAfterSeconds: 0, name: 'idx_slot_locks_ttl', background: true } },

  // 18–19. Índices de Rate Limiting Distribuido (rate_limits)
  { col: 'rate_limits', spec: { key: 1 }, opts: { unique: true, name: 'uniq_rate_limits_key', background: true } },
  { col: 'rate_limits', spec: { expiresAtDate: 1 }, opts: { expireAfterSeconds: 0, name: 'idx_rate_limits_ttl', background: true } }
];

function indexKeyMatches(actualKey, expectedSpec) {
  if (!actualKey || typeof actualKey !== 'object') return false;
  const actualEntries = Object.entries(actualKey);
  const expectedEntries = Object.entries(expectedSpec);
  if (actualEntries.length !== expectedEntries.length) return false;
  for (let i = 0; i < expectedEntries.length; i++) {
    const [eField, eDir] = expectedEntries[i];
    const [aField, aDir] = actualEntries[i];
    if (aField !== eField || Number(aDir) !== Number(eDir)) return false;
  }
  return true;
}

let indexesEnsured = false;
let indexEnsurePromise = null;

export function resetIndexesEnsuredFlag() {
  indexesEnsured = false;
  indexEnsurePromise = null;
}

export async function ensureMongoIndexes(targetDb = null) {
  const database = targetDb || await getMongoDb();
  if (!database) return { ok: false, verified: false, reason: 'no_db', indexes: [] };

  if (!targetDb && indexEnsurePromise) {
    return indexEnsurePromise;
  }

  const runEnsure = async () => {
    const startMs = Date.now();
    const created = [];
    const creationErrors = [];
    const verifiedIndexes = [];
    const missingOrInvalid = [];

    try {
      // 0. Deduplicar preventivamente antes de asegurar índices únicos
      await deduplicateCollectionByField(database, 'bookings', 'id');
      await deduplicateCollectionByField(database, 'payments', 'id');
      await deduplicateCollectionByField(database, 'payments', 'reference');
      await deduplicateCollectionByField(database, 'payments', 'transactionId');
      await deduplicateCollectionByField(database, 'sessions', 'id');
      await deduplicateCollectionByField(database, 'sessions', 'token');
      await deduplicateCollectionByField(database, 'reviews', 'id');
      await deduplicateCollectionByField(database, 'reviews', 'galleryToken');
      await deduplicateCollectionByField(database, 'audit_logs', 'id');

      const safeCreateIndex = async (colName, spec, opts) => {
        const indexId = `${colName}:${opts.name}`;
        try {
          await database.collection(colName).createIndex(spec, opts);
          created.push(indexId);
        } catch (err) {
          // Si ya existe un índice con el mismo nombre pero opciones previas (ej. no-unique),
          // eliminarlo y recrearlo con las garantías actuales; NO silenciar si el segundo intento falla.
          if (opts?.name) {
            try {
              await database.collection(colName).dropIndex(opts.name);
              await database.collection(colName).createIndex(spec, opts);
              created.push(indexId);
            } catch (retryErr) {
              creationErrors.push({
                index: indexId,
                error: retryErr?.message || err?.message || String(retryErr)
              });
            }
          } else {
            creationErrors.push({
              index: indexId,
              error: err?.message || String(err)
            });
          }
        }
      };

      for (const item of EXPECTED_MONGO_INDEXES) {
        await safeCreateIndex(item.col, item.spec, item.opts);
      }

      // Verificación real mediante listIndexes() sobre cada colección en MongoDB
      const collectionsToVerify = [...new Set(EXPECTED_MONGO_INDEXES.map(i => i.col))];
      const actualByCol = {};
      for (const colName of collectionsToVerify) {
        try {
          const colObj = database.collection(colName);
          if (typeof colObj.listIndexes === 'function') {
            actualByCol[colName] = await colObj.listIndexes().toArray();
          } else {
            actualByCol[colName] = [];
          }
        } catch (listErr) {
          actualByCol[colName] = [];
          creationErrors.push({
            collection: colName,
            error: `Fallo en listIndexes(): ${listErr?.message || String(listErr)}`
          });
        }
      }

      for (const expected of EXPECTED_MONGO_INDEXES) {
        const indexId = `${expected.col}:${expected.opts.name}`;
        const list = Array.isArray(actualByCol[expected.col]) ? actualByCol[expected.col] : [];
        const found = list.find(idx => idx && idx.name === expected.opts.name);

        if (!found) {
          missingOrInvalid.push({ index: indexId, reason: 'missing' });
          continue;
        }
        if (!indexKeyMatches(found.key, expected.spec)) {
          missingOrInvalid.push({ index: indexId, reason: 'key_mismatch', actualKey: found.key, expectedKey: expected.spec });
          continue;
        }
        if (Boolean(expected.opts.unique) !== Boolean(found.unique)) {
          missingOrInvalid.push({ index: indexId, reason: 'unique_mismatch', actual: Boolean(found.unique), expected: Boolean(expected.opts.unique) });
          continue;
        }
        if (Boolean(expected.opts.sparse) !== Boolean(found.sparse)) {
          missingOrInvalid.push({ index: indexId, reason: 'sparse_mismatch', actual: Boolean(found.sparse), expected: Boolean(expected.opts.sparse) });
          continue;
        }
        if (typeof expected.opts.expireAfterSeconds === 'number' && found.expireAfterSeconds !== expected.opts.expireAfterSeconds) {
          missingOrInvalid.push({
            index: indexId,
            reason: 'ttl_mismatch',
            actual: found.expireAfterSeconds,
            expected: expected.opts.expireAfterSeconds
          });
          continue;
        }
        verifiedIndexes.push(indexId);
      }

      const allVerified =
        creationErrors.length === 0 &&
        missingOrInvalid.length === 0 &&
        verifiedIndexes.length === EXPECTED_MONGO_INDEXES.length;

      if (allVerified) {
        indexesEnsured = true;
      }

      return {
        ok: allVerified,
        verified: allVerified,
        elapsedMs: Date.now() - startMs,
        indexes: verifiedIndexes,
        createdCount: created.length,
        verifiedCount: verifiedIndexes.length,
        expectedCount: EXPECTED_MONGO_INDEXES.length,
        missingOrInvalid,
        errors: creationErrors
      };
    } catch (err) {
      console.warn('⚠️ [MongoDB Indexes] Advertencia asegurando índices:', err?.message || err);
      return {
        ok: false,
        verified: false,
        elapsedMs: Date.now() - startMs,
        error: err?.message || String(err),
        indexes: verifiedIndexes,
        missingOrInvalid,
        errors: creationErrors
      };
    } finally {
      if (!targetDb) {
        indexEnsurePromise = null;
      }
    }
  };

  if (!targetDb) {
    indexEnsurePromise = runEnsure();
    return indexEnsurePromise;
  }
  return runEnsure();
}

/**
 * Construye la lista ordenada de claves de cubetas (buckets) de 15 minutos para un intervalo horario.
 * Garantiza que dos solicitudes solapadas (ej. 10:00-12:00 y 10:30-12:30) colisionen de forma atómica
 * en el índice único `uniq_slot_locks_key` de MongoDB sin depender de lecturas previas no atómicas.
 */
export function buildSlotLockBucketKeys(arg1 = {}, startMinArg = undefined, endMinArg = undefined, bucketStepArg = 15) {
  const opts = typeof arg1 === 'string'
    ? { dateKey: arg1, startMin: startMinArg, endMin: endMinArg, bucketStepMin: bucketStepArg }
    : (arg1 || {});
  const { lockKey, dateKey, startMin, endMin, bucketStepMin = 15 } = opts;
  const keys = [];
  if (dateKey && Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin) {
    const step = Math.max(5, Number(bucketStepMin) || 15);
    const firstBucket = Math.floor(startMin / step) * step;
    for (let m = firstBucket; m < endMin; m += step) {
      keys.push(`slot_bucket_${dateKey}_${m}`);
    }
  } else if (lockKey) {
    keys.push(String(lockKey));
  }
  return keys;
}

/**
 * Adquiere un bloqueo distribuido atómico en MongoDB Atlas para evitar doble reserva concurrente
 * o doble checkout entre múltiples instancias serverless de Vercel.
 * Opera con política fail-closed ante errores inesperados de base de datos.
 */
export async function acquireDistributedSlotLock({
  lockKey,
  dateKey,
  startMin,
  endMin,
  ttlMs = 30000,
  failClosed = true,
  targetDb = null
} = {}) {
  const database = targetDb || await getMongoDb();
  if (!database) {
    const mustFailClosed = failClosed !== false && (process.env.NODE_ENV === 'production' || isMongoConfigured());
    if (mustFailClosed) {
      return { acquired: false, distributed: false, error: 'Persistencia MongoDB no disponible para bloqueo distribuido' };
    }
    return { acquired: true, distributed: false };
  }

  const now = new Date();
  const expiresAtDate = new Date(now.getTime() + ttlMs);
  const col = database.collection('slot_locks');
  const bucketKeys = buildSlotLockBucketKeys({ lockKey, dateKey, startMin, endMin });
  if (bucketKeys.length === 0) {
    return { acquired: false, distributed: true, error: 'No se pudo derivar clave de bloqueo distribuido' };
  }

  const ownerId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${ crypto.randomBytes(6).toString('hex') }`;
  const acquiredKeys = [];

  const rollbackAcquired = async () => {
    if (acquiredKeys.length === 0) return;
    try {
      await col.deleteMany({ lockKey: { $in: acquiredKeys }, ownerId });
    } catch {}
  };

  try {
    for (const bKey of bucketKeys) {
      // 1. Purgar exclusivamente si el bucket específico ya venció
      await col.deleteMany({ lockKey: bKey, expiresAtDate: { $lte: now } });

      // 2. Inserción condicional atómica protegida por el índice único uniq_slot_locks_key
      try {
        const res = await col.updateOne(
          { lockKey: bKey },
          {
            $setOnInsert: {
              lockKey: bKey,
              ownerId,
              dateKey: dateKey || null,
              startMin: Number.isFinite(startMin) ? startMin : null,
              endMin: Number.isFinite(endMin) ? endMin : null,
              createdAt: now.toISOString(),
              expiresAtDate
            }
          },
          { upsert: true }
        );

        const wasInserted = Boolean(
          res &&
          (
            (typeof res.upsertedCount === 'number' && res.upsertedCount > 0) ||
            res.upsertedId ||
            (res.matchedCount === 0 && res.upsertedCount === undefined)
          )
        );

        if (!wasInserted) {
          await rollbackAcquired();
          return { acquired: false, distributed: true, conflictKey: bKey };
        }
        acquiredKeys.push(bKey);
      } catch (bucketErr) {
        await rollbackAcquired();
        if (bucketErr?.code === 11000) {
          return { acquired: false, distributed: true, conflictKey: bKey };
        }
        throw bucketErr;
      }
    }

    return {
      acquired: true,
      distributed: true,
      lockKey: acquiredKeys[0] || lockKey,
      lockKeys: acquiredKeys,
      ownerId
    };
  } catch (err) {
    await rollbackAcquired();
    if (err?.code === 11000) {
      return { acquired: false, distributed: true };
    }
    return {
      acquired: failClosed === false,
      distributed: true,
      error: err?.message || String(err)
    };
  }
}

export async function releaseDistributedSlotLock(lockOrHandle, { targetDb = null } = {}) {
  if (!lockOrHandle) return;
  const database = targetDb || await getMongoDb();
  if (!database) return;
  const col = database.collection('slot_locks');

  try {
    if (typeof lockOrHandle === 'string') {
      await col.deleteOne({ lockKey: lockOrHandle });
      return;
    }
    if (Array.isArray(lockOrHandle)) {
      if (lockOrHandle.length > 0) {
        await col.deleteMany({ lockKey: { $in: lockOrHandle } });
      }
      return;
    }
    if (typeof lockOrHandle === 'object') {
      const keys = Array.isArray(lockOrHandle.lockKeys) && lockOrHandle.lockKeys.length > 0
        ? lockOrHandle.lockKeys
        : (lockOrHandle.lockKey ? [lockOrHandle.lockKey] : []);
      if (keys.length === 0) return;
      const filter = { lockKey: { $in: keys } };
      if (lockOrHandle.ownerId) {
        filter.ownerId = lockOrHandle.ownerId;
      }
      await col.deleteMany(filter);
    }
  } catch {}
}

/**
 * Verifica y actualiza de forma atómica un contador de límite de intentos en MongoDB Atlas.
 * Usa `findOneAndUpdate` condicional (`count < maxAttempts`) + índice único `uniq_rate_limits_key`
 * para impedir condiciones de carrera bajo ráfagas simultáneas.
 */
export async function checkDistributedRateLimit({
  key,
  maxAttempts,
  windowMs,
  failClosed = false,
  targetDb = null
} = {}) {
  if (!key) return { allowed: true, distributed: false };
  const database = targetDb || await getMongoDb();
  if (!database) {
    if (failClosed && (process.env.NODE_ENV === 'production' || isMongoConfigured())) {
      return { allowed: false, distributed: false, error: 'rate_limit_db_unavailable' };
    }
    return { allowed: true, distributed: false };
  }

  const now = Date.now();
  const nowDate = new Date(now);
  const expiresAtDate = new Date(now + windowMs);
  const col = database.collection('rate_limits');

  try {
    // 1. Eliminar ventana vencida de forma atómica si ya caducó
    await col.deleteMany({ key, expiresAtDate: { $lte: nowDate } });

    // 2. Incrementar atómicamente solo si count < maxAttempts (o insertar con count=1 si no existe).
    // Si el documento existe y ya alcanzó count >= maxAttempts, el filtro no coincide y el upsert
    // intenta insertar un duplicado sobre uniq_rate_limits_key, arrojando código 11000 atómicamente.
    const updated = await col.findOneAndUpdate(
      {
        key,
        $or: [
          { count: { $lt: maxAttempts } },
          { count: { $exists: false } }
        ]
      },
      {
        $inc: { count: 1 },
        $setOnInsert: {
          key,
          windowStart: now,
          expiresAtDate
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    const doc = updated && typeof updated === 'object' && 'value' in updated ? updated.value : updated;
    if (!doc) {
      return {
        allowed: false,
        count: maxAttempts,
        retryAfterMs: windowMs,
        distributed: true
      };
    }

    return {
      allowed: true,
      count: Number(doc.count) || 1,
      distributed: true
    };
  } catch (err) {
    if (err?.code === 11000) {
      let retryAfterMs = windowMs;
      let currentCount = maxAttempts;
      try {
        const existing = await col.findOne({ key });
        if (existing) {
          currentCount = Number(existing.count) || maxAttempts;
          if (existing.expiresAtDate) {
            retryAfterMs = Math.max(0, new Date(existing.expiresAtDate).getTime() - now);
          }
        }
      } catch {}
      return {
        allowed: false,
        count: currentCount,
        retryAfterMs,
        distributed: true
      };
    }
    return {
      allowed: !failClosed,
      distributed: false,
      error: err?.message || String(err)
    };
  }
}

/**
 * Limpia un contador de límite de intentos distribuido en MongoDB Atlas (por ejemplo, tras un login exitoso).
 */
export async function resetDistributedRateLimit(key, { targetDb = null } = {}) {
  if (!key) return;
  try {
    const database = targetDb || await getMongoDb();
    if (!database) return;
    await database.collection('rate_limits').deleteOne({ key });
  } catch {}
}

/**
 * Persiste un desafío biométrico de un solo uso con TTL en MongoDB Atlas (Hallazgo A2 / B1),
 * permitiendo que `/api/admin/auth/bio-challenge` y `/api/admin/auth/bio-refresh` funcionen
 * incluso cuando caen en distintas instancias serverless de Vercel.
 */
export async function saveDistributedBioChallenge(challenge, { ip = 'unknown', ttlMs = 60000, targetDb = null } = {}) {
  if (!challenge) return false;
  const database = targetDb || await getMongoDb();
  if (!database) return false;
  const now = new Date();
  const expiresAtDate = new Date(now.getTime() + Math.max(5000, Number(ttlMs) || 60000));
  const lockKey = `bio_chal_${String(challenge).trim()}`;
  try {
    await database.collection('slot_locks').updateOne(
      { lockKey },
      {
        $set: {
          lockKey,
          kind: 'bio_challenge',
          challenge: String(challenge).trim(),
          ip: String(ip || 'unknown'),
          createdAt: now.toISOString(),
          expiresAt: expiresAtDate.getTime(),
          expiresAtDate
        }
      },
      { upsert: true }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Consume de forma atómica (`findOneAndDelete`) un desafío biométrico en MongoDB Atlas.
 * Garantiza un único uso real entre múltiples instancias serverless.
 */
export async function consumeDistributedBioChallenge(challenge, { targetDb = null } = {}) {
  if (!challenge || typeof challenge !== 'string') return null;
  const database = targetDb || await getMongoDb();
  if (!database) return null;
  const lockKey = `bio_chal_${String(challenge).trim()}`;
  const now = new Date();
  try {
    const removed = await database.collection('slot_locks').findOneAndDelete({
      lockKey,
      expiresAtDate: { $gt: now }
    });
    const doc = removed && typeof removed === 'object' && 'value' in removed ? removed.value : removed;
    if (!doc) return null;
    return {
      challenge: doc.challenge || challenge,
      ip: doc.ip || 'unknown',
      expiresAt: Number(doc.expiresAt) || new Date(doc.expiresAtDate).getTime()
    };
  } catch {
    return null;
  }
}

export async function pingMongoDB() {
  const start = Date.now();
  try {
    const database = await getMongoDb();
    if (!database) {
      return { ok: false, connected: false, latencyMs: null, error: 'No se pudo establecer conexión con MongoDB Atlas' };
    }
    await database.command({ ping: 1 });
    if (!indexesEnsured) {
      ensureMongoIndexes(database).catch(() => {});
    }
    return { ok: true, connected: true, latencyMs: Date.now() - start, error: null, indexesEnsured };
  } catch (err) {
    return { ok: false, connected: false, latencyMs: Date.now() - start, error: err?.message || String(err) };
  }
}

/**
 * Helper seguro para hacer upsert de un documento en una colección por su `id` (o filtro personalizado).
 */
export async function upsertMongoDoc(collectionName, filter, doc, { throwOnError = false } = {}) {
  const database = await getMongoDb();
  if (!database) {
    if (throwOnError) {
      throw new Error(`MongoDB Atlas no disponible al intentar escribir en "${collectionName}"`);
    }
    return false;
  }
  try {
    const { _id, ...cleanDoc } = doc || {};
    const result = await database.collection(collectionName).updateOne(
      filter,
      { $set: { ...cleanDoc, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    if (!result || result.acknowledged !== true) {
      throw new Error(`Escritura no reconocida (acknowledged=false) en "${collectionName}"`);
    }
    return true;
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Error en upsert (${collectionName}):`, err?.message || err);
    if (throwOnError) throw err;
    return false;
  }
}

/**
 * Helper para actualizar un documento existente sin upsert, retornando el resultado completo (matchedCount, modifiedCount)
 * para verificaciones de atomicidad y concurrencia (ej. webhooks de pago).
 */
export async function updateMongoDoc(collectionName, filter, update, { throwOnError = false } = {}) {
  const database = await getMongoDb();
  if (!database) {
    if (throwOnError) {
      throw new Error(`MongoDB Atlas no disponible al intentar actualizar en "${collectionName}"`);
    }
    return { acknowledged: false, matchedCount: 0, modifiedCount: 0 };
  }
  try {
    const result = await database.collection(collectionName).updateOne(filter, update);
    if (!result || result.acknowledged !== true) {
      throw new Error(`Actualización no reconocida en "${collectionName}"`);
    }
    return result;
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Error en updateOne (${collectionName}):`, err?.message || err);
    if (throwOnError) throw err;
    return { acknowledged: false, matchedCount: 0, modifiedCount: 0 };
  }
}

/**
 * Helper seguro para leer documentos de una colección.
 */
export async function findMongoDocs(collectionName, filter = {}, sort = null, limit = 0, { throwOnError = false } = {}) {
  const database = await getMongoDb();
  if (!database) {
    if (throwOnError) {
      throw new Error(`MongoDB Atlas no disponible al intentar leer "${collectionName}"`);
    }
    return null;
  }
  try {
    let cursor = database.collection(collectionName).find(filter);
    if (sort) cursor = cursor.sort(sort);
    if (limit > 0) cursor = cursor.limit(limit);
    return await cursor.toArray();
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Error leyendo (${collectionName}):`, err?.message || err);
    if (throwOnError) throw err;
    return null;
  }
}

/**
 * Helper seguro para buscar un único documento en una colección.
 */
export async function findMongoDoc(collectionName, filter = {}, { throwOnError = false } = {}) {
  const database = await getMongoDb();
  if (!database) {
    if (throwOnError) {
      throw new Error(`MongoDB Atlas no disponible al intentar leer documento en "${collectionName}"`);
    }
    return null;
  }
  try {
    const doc = await database.collection(collectionName).findOne(filter);
    if (!doc) return null;
    const { _id, ...cleanDoc } = doc;
    return cleanDoc;
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Error en findOne (${collectionName}):`, err?.message || err);
    if (throwOnError) throw err;
    return null;
  }
}

/**
 * Helper seguro para eliminar un documento de una colección.
 */
export async function deleteMongoDoc(collectionName, filter, { throwOnError = false } = {}) {
  const database = await getMongoDb();
  if (!database) {
    if (throwOnError) {
      throw new Error(`MongoDB Atlas no disponible al intentar eliminar en "${collectionName}"`);
    }
    return { acknowledged: false, deletedCount: 0 };
  }
  try {
    const result = await database.collection(collectionName).deleteOne(filter);
    if (!result || result.acknowledged !== true) {
      throw new Error(`Eliminación no reconocida en "${collectionName}"`);
    }
    return { acknowledged: true, deletedCount: result.deletedCount || 0 };
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Error eliminando (${collectionName}):`, err?.message || err);
    if (throwOnError) throw err;
    return { acknowledged: false, deletedCount: 0 };
  }
}

/**
 * Helper seguro para eliminar múltiples documentos de una colección.
 */
export async function deleteMongoDocs(collectionName, filter, { throwOnError = false } = {}) {
  const database = await getMongoDb();
  if (!database) {
    if (throwOnError) {
      throw new Error(`MongoDB Atlas no disponible al intentar eliminar lote en "${collectionName}"`);
    }
    return { acknowledged: false, deletedCount: 0 };
  }
  try {
    const result = await database.collection(collectionName).deleteMany(filter);
    if (!result || result.acknowledged !== true) {
      throw new Error(`Eliminación múltiple no reconocida en "${collectionName}"`);
    }
    return { acknowledged: true, deletedCount: result.deletedCount || 0 };
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Error eliminando varios (${collectionName}):`, err?.message || err);
    if (throwOnError) throw err;
    return { acknowledged: false, deletedCount: 0 };
  }
}
