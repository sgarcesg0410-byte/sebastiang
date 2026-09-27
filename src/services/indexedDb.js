// src/services/indexedDb.js
// Almacenamiento local persistente de alta capacidad (100MB+) usando IndexedDB
// Supera con creces el límite de 5MB de localStorage, evitando QuotaExceededError
// y protegiendo las fotos de catálogo y sesiones del fotógrafo ante cualquier desconexión.

const DB_NAME = 'SebastianG_Storage_v1';
const DB_VERSION = 1;
const CATALOG_STORE = 'catalog';
const SESSIONS_STORE = 'sessions';

let dbPromise = null;

function getDB() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB no está disponible en este entorno.'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(CATALOG_STORE)) {
            db.createObjectStore(CATALOG_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
            db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          dbPromise = null;
          reject(req.error);
        };
      } catch (err) {
        dbPromise = null;
        reject(err);
      }
    });
  }
  return dbPromise;
}

export async function idbGetCatalog() {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CATALOG_STORE, 'readonly');
      const store = tx.objectStore(CATALOG_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

export async function idbSaveCatalogItem(item) {
  if (!item || !item.id) return false;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CATALOG_STORE, 'readwrite');
      const store = tx.objectStore(CATALOG_STORE);
      store.put(item);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

export async function idbSaveCatalogBatch(items) {
  if (!Array.isArray(items) || items.length === 0) return false;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CATALOG_STORE, 'readwrite');
      const store = tx.objectStore(CATALOG_STORE);
      for (const item of items) {
        if (item && item.id) store.put(item);
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

export async function idbDeleteCatalogItem(id) {
  if (!id) return false;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CATALOG_STORE, 'readwrite');
      const store = tx.objectStore(CATALOG_STORE);
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

export async function idbGetSessions() {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SESSIONS_STORE, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

export async function idbSaveSession(session) {
  if (!session || !session.id) return false;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      const store = tx.objectStore(SESSIONS_STORE);
      store.put(session);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

export async function idbDeleteSession(id) {
  if (!id) return false;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      const store = tx.objectStore(SESSIONS_STORE);
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}
