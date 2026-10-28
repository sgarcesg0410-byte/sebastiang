import { MongoClient } from 'mongodb';

// ==============================================================================
// MONGODB ATLAS CLIENT (SINGLETON CON POOL DE CONEXIONES PARA SERVERLESS/VERCEL)
// ==============================================================================
// Provee alta disponibilidad y almacenamiento permanente para:
// - bookings (reservas de clientes)
// - catalog (portafolio y productos)
// - packages (paquetes y precios)
// - settings (configuraciones generales, contraseñas y hashes)
// - payments (comprobantes y pagos registrados)
// - reviews (calificaciones y testimonios)
// - sessions (galerías privadas de entrega)
// ==============================================================================

function getMongoUri() {
  return String(process.env.MONGODB_URI || '').trim().replace(/^['"]|['"]$/g, '');
}

function getMongoDbName() {
  return String(process.env.MONGODB_DB_NAME || 'sebastiang').trim().replace(/^['"]|['"]$/g, '');
}

let client = null;
let clientPromise = null;

export function isMongoConfigured() {
  if ((process.env.NODE_ENV === 'test' || process.env.VITEST) && process.env.ALLOW_MONGO_IN_TESTS !== 'true') {
    return false;
  }
  const currentUri = getMongoUri();
  return Boolean(currentUri && currentUri.startsWith('mongodb'));
}

export async function getMongoClient() {
  if (!isMongoConfigured()) {
    return null;
  }

  const currentUri = getMongoUri();

  const serverSelectionTimeoutMS = process.env.NODE_ENV === 'test' ? 1000 : 5000;

  if (process.env.NODE_ENV === 'development' || !process.env.VERCEL) {
    // Modo local / desarrollo: reusar en global para hot reloading
    if (!global._mongoClientPromise) {
      client = new MongoClient(currentUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS
      });
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    // Modo producción Serverless (Vercel): reusar cliente en memoria
    if (!clientPromise) {
      client = new MongoClient(currentUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS
      });
      clientPromise = client.connect();
    }
  }

  try {
    const connectedClient = await clientPromise;
    return connectedClient;
  } catch (err) {
    clientPromise = null;
    if (global._mongoClientPromise) {
      global._mongoClientPromise = null;
    }
    console.warn('⚠️ [MongoDB Atlas] Error conectando a la base de datos:', err?.message || err);
    return null;
  }
}

export async function getMongoDB() {
  const connectedClient = await getMongoClient();
  if (!connectedClient) return null;
  return connectedClient.db(getMongoDbName());
}

/**
 * Comprueba la conectividad real con MongoDB Atlas mediante un comando ping activo.
 * Retorna { ok: true, latencyMs } o { ok: false, reason, error }
 */
export async function pingMongoDB({ timeoutMs = 2000 } = {}) {
  if (!isMongoConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }
  const start = performance.now();
  let timer = null;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timeout de conexión a MongoDB Atlas')), timeoutMs);
      if (timer && timer.unref) timer.unref();
    });

    const db = await Promise.race([getMongoDB(), timeoutPromise]);
    if (!db) {
      if (timer) clearTimeout(timer);
      return { ok: false, reason: 'connection_failed' };
    }
    await Promise.race([db.command({ ping: 1 }), timeoutPromise]);
    if (timer) clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - start);
    return { ok: true, latencyMs };
  } catch (err) {
    if (timer) clearTimeout(timer);
    return { ok: false, reason: 'ping_failed', error: err?.message || String(err) };
  }
}

/**
 * Guarda o actualiza un documento en una colección de MongoDB de forma segura.
 * Si throwOnError es true, propaga cualquier error de conexión o rechazo de escritura
 * para permitir control transaccional estricto en flujos críticos (pagos/reservas).
 */
export async function upsertMongoDoc(collectionName, filter, doc, { throwOnError = false } = {}) {
  try {
    const db = await getMongoDB();
    if (!db) {
      if (throwOnError) throw new Error(`MongoDB no está conectado para escribir en ${collectionName}`);
      return false;
    }
    const col = db.collection(collectionName);
    const { _id, ...cleanDoc } = doc;
    const res = await col.updateOne(
      filter,
      { $set: { ...cleanDoc, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    if (res && res.acknowledged === false) {
      if (throwOnError) throw new Error(`Escritura en ${collectionName} no reconocida por MongoDB Atlas`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Error guardando en ${collectionName}:`, err?.message || err);
    if (throwOnError) throw err;
    return false;
  }
}

/**
 * Obtiene documentos de una colección de MongoDB
 */
export async function findMongoDocs(collectionName, filter = {}, sort = { updatedAt: -1 }, limit = 1000) {
  try {
    const db = await getMongoDB();
    if (!db) return null;
    const col = db.collection(collectionName);
    const cursor = col.find(filter).sort(sort).limit(limit);
    return await cursor.toArray();
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Error leyendo de ${collectionName}:`, err?.message || err);
    return null;
  }
}

/**
 * Obtiene un único documento de una colección de MongoDB
 */
export async function findMongoDoc(collectionName, filter = {}) {
  try {
    const db = await getMongoDB();
    if (!db) return null;
    const col = db.collection(collectionName);
    return await col.findOne(filter);
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Error buscando en ${collectionName}:`, err?.message || err);
    return null;
  }
}

/**
 * Elimina un documento de una colección de MongoDB
 */
export async function deleteMongoDoc(collectionName, filter) {
  try {
    const db = await getMongoDB();
    if (!db) return false;
    const col = db.collection(collectionName);
    const res = await col.deleteOne(filter);
    return res.deletedCount > 0;
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Error eliminando en ${collectionName}:`, err?.message || err);
    return false;
  }
}

/**
 * Actualiza atómicamente un documento de MongoDB sin forzar upsert
 * Retorna el resultado del driver de MongoDB ({ matchedCount, modifiedCount, acknowledged })
 */
export async function updateMongoDoc(collectionName, filter, update, { throwOnError = false } = {}) {
  try {
    const db = await getMongoDB();
    if (!db) {
      if (throwOnError) throw new Error(`MongoDB no está conectado para actualizar en ${collectionName}`);
      return null;
    }
    const col = db.collection(collectionName);
    const res = await col.updateOne(filter, update);
    return res;
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Error actualizando en ${collectionName}:`, err?.message || err);
    if (throwOnError) throw err;
    return null;
  }
}

/**
 * Crea y verifica los índices operativos y el índice TTL de 90 días en MongoDB Atlas.
 * Puede ejecutarse contra la base principal o contra una base temporal de simulacro/staging.
 */
export async function ensureMongoIndexes(dbOverride = null) {
  const startMs = performance.now();
  try {
    const db = dbOverride || (await getMongoDB());
    if (!db) {
      return { verified: false, reason: 'mongo_not_configured', elapsedMs: 0, indexes: [] };
    }

    const created = [];
    const specs = [
      { col: 'bookings', key: { id: 1 }, opts: { name: 'idx_bookings_id' } },
      { col: 'bookings', key: { createdAt: -1 }, opts: { name: 'idx_bookings_created_desc' } },
      { col: 'bookings', key: { dateTime: 1 }, opts: { name: 'idx_bookings_datetime' } },
      { col: 'payments', key: { id: 1 }, opts: { name: 'idx_payments_id' } },
      { col: 'payments', key: { reference: 1 }, opts: { name: 'idx_payments_reference_unique', unique: true, sparse: true } },
      { col: 'payments', key: { transactionId: 1 }, opts: { name: 'idx_payments_transaction_id_unique', unique: true, sparse: true } },
      { col: 'payments', key: { bookingId: 1 }, opts: { name: 'idx_payments_booking_id' } },
      { col: 'sessions', key: { token: 1 }, opts: { name: 'idx_sessions_token' } },
      { col: 'sessions', key: { id: 1 }, opts: { name: 'idx_sessions_id' } },
      { col: 'audit_logs', key: { id: 1 }, opts: { name: 'idx_audit_logs_id' } },
      { col: 'audit_logs', key: { createdAt: -1 }, opts: { name: 'idx_audit_logs_created_desc' } },
      // Índice TTL nativo de MongoDB Atlas: purga automática al cumplirse expiresAtDate (90 días)
      { col: 'audit_logs', key: { expiresAtDate: 1 }, opts: { name: 'idx_audit_logs_ttl_90d', expireAfterSeconds: 0 } }
    ];

    for (const s of specs) {
      const idxName = await db.collection(s.col).createIndex(s.key, s.opts);
      created.push(`${s.col}.${idxName}`);
    }

    return {
      verified: true,
      elapsedMs: Math.max(1, Math.round(performance.now() - startMs)),
      indexes: created
    };
  } catch (err) {
    console.warn('⚠️ [MongoDB] Error asegurando índices:', err?.message || err);
    return {
      verified: false,
      reason: err?.message || 'index_error',
      elapsedMs: Math.max(1, Math.round(performance.now() - startMs)),
      indexes: []
    };
  }
}
