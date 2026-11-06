// api/db/mongo.js
// ==============================================================================
// CLIENTE CENTRALIZADO DE MONGODB ATLAS (Conexión reutilizable en Serverless)
// ==============================================================================
// Proporciona conexión persistente con pooling para Vercel Serverless y Node local.
// Si MONGODB_URI no está definida, el sistema opera de forma transparente con sus
// respaldos locales sin arrojar errores fatales.
// ==============================================================================

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
 * Crea y verifica los 17 índices críticos de producción e índices TTL en MongoDB Atlas:
 * - Unicidad estricta en `bookings.id`, `payments.id`, `payments.reference`, `payments.transactionId`,
 *   `sessions.id`, `sessions.token`, `audit_logs.id`, `slot_locks.lockKey` y `rate_limits.key`.
 * - Índice compuesto `{ dateTime: 1, status: 1 }` en `bookings` para detección rápida de cruces de horario.
 * - Índice `{ expiresAt: 1 }` en `sessions` para control de caducidad de galerías privadas.
 * - Índices TTL nativos en `audit_logs` (90 días), `slot_locks` y `rate_limits`.
 */
let indexesEnsured = false;
export async function ensureMongoIndexes(targetDb = null) {
  const database = targetDb || await getMongoDb();
  if (!database) return { ok: false, verified: false, reason: 'no_db', indexes: [] };

  const startMs = Date.now();
  const created = [];

  try {
    // 0. Deduplicar preventivamente antes de asegurar índices únicos
    await deduplicateCollectionByField(database, 'bookings', 'id');
    await deduplicateCollectionByField(database, 'payments', 'id');
    await deduplicateCollectionByField(database, 'payments', 'reference');
    await deduplicateCollectionByField(database, 'payments', 'transactionId');
    await deduplicateCollectionByField(database, 'sessions', 'id');
    await deduplicateCollectionByField(database, 'sessions', 'token');
    await deduplicateCollectionByField(database, 'audit_logs', 'id');

    const safeCreateIndex = async (colName, spec, opts) => {
      try {
        await database.collection(colName).createIndex(spec, opts);
      } catch (err) {
        // Si ya existe un índice con el mismo nombre pero opciones previas (ej. no-unique),
        // eliminarlo y recrearlo con las garantías actuales
        if (opts?.name) {
          try {
            await database.collection(colName).dropIndex(opts.name);
            await database.collection(colName).createIndex(spec, opts);
          } catch {}
        }
      }
      created.push(`${colName}:${opts.name}`);
    };

    // 1–3. Índices de Reservas (bookings)
    await safeCreateIndex('bookings', { id: 1 }, { unique: true, name: 'uniq_bookings_id', background: true });
    await safeCreateIndex('bookings', { dateTime: 1, status: 1 }, { name: 'idx_bookings_datetime_status', background: true });
    await safeCreateIndex('bookings', { createdAt: -1 }, { name: 'idx_bookings_created_desc', background: true });

    // 4–7. Índices de Pagos y Anti-Replay de Pasarela (payments)
    await safeCreateIndex('payments', { id: 1 }, { unique: true, name: 'uniq_payments_id', background: true });
    await safeCreateIndex('payments', { reference: 1 }, { unique: true, sparse: true, name: 'uniq_payments_reference', background: true });
    await safeCreateIndex('payments', { transactionId: 1 }, { unique: true, sparse: true, name: 'uniq_payments_txid', background: true });
    await safeCreateIndex('payments', { bookingId: 1 }, { name: 'idx_payments_booking_id', background: true });

    // 8–10. Índices de Galerías Privadas (sessions)
    await safeCreateIndex('sessions', { id: 1 }, { unique: true, name: 'uniq_sessions_id', background: true });
    await safeCreateIndex('sessions', { token: 1 }, { unique: true, name: 'uniq_sessions_token', background: true });
    await safeCreateIndex('sessions', { expiresAt: 1 }, { name: 'idx_sessions_expires_at', background: true });

    // 11–13. Índices de Auditoría Financiera + TTL automático de 90 días (audit_logs)
    await safeCreateIndex('audit_logs', { id: 1 }, { unique: true, name: 'uniq_audit_logs_id', background: true });
    await safeCreateIndex('audit_logs', { createdAt: -1 }, { name: 'idx_audit_logs_created_desc', background: true });
    await safeCreateIndex('audit_logs', { expiresAtDate: 1 }, { expireAfterSeconds: 0, name: 'idx_audit_logs_ttl_90d', background: true });

    // 14–15. Índices de Bloqueo Distribuido de Horarios (slot_locks)
    await safeCreateIndex('slot_locks', { lockKey: 1 }, { unique: true, name: 'uniq_slot_locks_key', background: true });
    await safeCreateIndex('slot_locks', { expiresAtDate: 1 }, { expireAfterSeconds: 0, name: 'idx_slot_locks_ttl', background: true });

    // 16–17. Índices de Rate Limiting Distribuido (rate_limits)
    await safeCreateIndex('rate_limits', { key: 1 }, { unique: true, name: 'uniq_rate_limits_key', background: true });
    await safeCreateIndex('rate_limits', { expiresAtDate: 1 }, { expireAfterSeconds: 0, name: 'idx_rate_limits_ttl', background: true });

    if (!targetDb) indexesEnsured = true;
    return {
      ok: true,
      verified: true,
      elapsedMs: Date.now() - startMs,
      indexes: created
    };
  } catch (err) {
    console.warn('⚠️ [MongoDB Indexes] Advertencia asegurando índices:', err?.message || err);
    return {
      ok: false,
      verified: false,
      elapsedMs: Date.now() - startMs,
      error: err?.message || String(err),
      indexes: created
    };
  }
}

/**
 * Adquiere un bloqueo distribuido en MongoDB Atlas para evitar doble reserva concurrente
 * entre múltiples instancias serverless de Vercel.
 */
export async function acquireDistributedSlotLock({ lockKey, dateKey, startMin, endMin, ttlMs = 30000 } = {}) {
  const database = await getMongoDb();
  if (!database) return { acquired: true, distributed: false };

  const now = new Date();
  const expiresAtDate = new Date(now.getTime() + ttlMs);
  const col = database.collection('slot_locks');

  try {
    // 1. Limpiar bloqueos vencidos del mismo día
    await col.deleteMany({ dateKey, expiresAtDate: { $lte: now } });

    // 2. Verificar si existe algún bloqueo activo que se solape con [startMin, endMin)
    const overlapping = await col.findOne({
      dateKey,
      expiresAtDate: { $gt: now },
      startMin: { $lt: endMin },
      endMin: { $gt: startMin }
    });
    if (overlapping) {
      return { acquired: false, distributed: true, conflictKey: overlapping.lockKey };
    }

    // 3. Insertar bloqueo con clave determinista por ventana o clave provista
    const effectiveKey = lockKey || `slot_${dateKey}_${startMin}`;
    await col.updateOne(
      { lockKey: effectiveKey, expiresAtDate: { $lte: now } },
      {
        $setOnInsert: {
          lockKey: effectiveKey,
          dateKey,
          startMin,
          endMin,
          createdAt: now.toISOString(),
          expiresAtDate
        }
      },
      { upsert: true }
    );
    return { acquired: true, distributed: true, lockKey: effectiveKey };
  } catch (err) {
    if (err?.code === 11000) {
      return { acquired: false, distributed: true };
    }
    return { acquired: true, distributed: false };
  }
}

export async function releaseDistributedSlotLock(lockKey) {
  if (!lockKey) return;
  const database = await getMongoDb();
  if (!database) return;
  try {
    await database.collection('slot_locks').deleteOne({ lockKey });
  } catch {}
}

/**
 * Verifica y actualiza de forma distribuida un contador de límite de intentos en MongoDB Atlas.
 */
export async function checkDistributedRateLimit({ key, maxAttempts, windowMs }) {
  const database = await getMongoDb();
  if (!database || !key) return { allowed: true, distributed: false };

  const now = Date.now();
  const nowDate = new Date(now);
  const expiresAtDate = new Date(now + windowMs);
  const col = database.collection('rate_limits');

  try {
    const existing = await col.findOne({ key });
    if (!existing || !existing.expiresAtDate || new Date(existing.expiresAtDate).getTime() <= now) {
      await col.updateOne(
        { key },
        { $set: { key, count: 1, windowStart: now, expiresAtDate } },
        { upsert: true }
      );
      return { allowed: true, count: 1, distributed: true };
    }

    if (existing.count >= maxAttempts) {
      return {
        allowed: false,
        count: existing.count,
        retryAfterMs: Math.max(0, new Date(existing.expiresAtDate).getTime() - now),
        distributed: true
      };
    }

    await col.updateOne(
      { key },
      { $inc: { count: 1 } }
    );
    return { allowed: true, count: existing.count + 1, distributed: true };
  } catch {
    return { allowed: true, distributed: false };
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
    return { ok: true, connected: true, latencyMs: Date.now() - start, error: null };
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
