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

  if (process.env.NODE_ENV === 'development' || !process.env.VERCEL) {
    // Modo local / desarrollo: reusar en global para hot reloading
    if (!global._mongoClientPromise) {
      client = new MongoClient(currentUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000
      });
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    // Modo producción Serverless (Vercel): reusar cliente en memoria
    if (!clientPromise) {
      client = new MongoClient(currentUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000
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
 * Guarda o actualiza un documento en una colección de MongoDB de forma segura
 */
export async function upsertMongoDoc(collectionName, filter, doc) {
  try {
    const db = await getMongoDB();
    if (!db) return false;
    const col = db.collection(collectionName);
    const { _id, ...cleanDoc } = doc;
    await col.updateOne(
      filter,
      { $set: { ...cleanDoc, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Error guardando en ${collectionName}:`, err?.message || err);
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
