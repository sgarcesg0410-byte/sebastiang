// src/services/indexedDb.js
// Almacenamiento local persistente de alta capacidad (100MB+) usando IndexedDB
// Supera con creces el límite de 5MB de localStorage, evitando QuotaExceededError
// y protegiendo las fotos de catálogo y sesiones del fotógrafo ante cualquier desconexión.

const DB_NAME = 'SebastianG_Storage_v1';
const DB_VERSION = 3;
const CATALOG_STORE = 'catalog';
const SESSIONS_STORE = 'sessions';
const BOOKINGS_STORE = 'bookings';
const VIP_CLIENTS_STORE = 'vip_clients';

let dbPromise = null;

export function resetIDBConnection() {
  dbPromise = null;
}

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
          if (!db.objectStoreNames.contains(BOOKINGS_STORE)) {
            db.createObjectStore(BOOKINGS_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(VIP_CLIENTS_STORE)) {
            db.createObjectStore(VIP_CLIENTS_STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => {
          const db = e.target.result;
          db.onclose = () => {
            dbPromise = null;
          };
          db.onversionchange = () => {
            try { db.close(); } catch (err) {}
            dbPromise = null;
          };
          db.onerror = () => {
            dbPromise = null;
          };
          resolve(db);
        };
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

async function withDB(op) {
  try {
    const db = await getDB();
    return await op(db);
  } catch (err) {
    // Si la conexión fue cerrada por el sistema operativo o WebView, reconectar de inmediato y reintentar
    console.warn('Conexión IDB reseteada tras error, reintentando operación:', err);
    dbPromise = null;
    const freshDb = await getDB();
    return await op(freshDb);
  }
}

export async function idbGetCatalog() {
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        const tx = db.transaction(CATALOG_STORE, 'readonly');
        const store = tx.objectStore(CATALOG_STORE);
        req.onsuccess = () => {
          const list = Array.isArray(req.result) ? req.result : [];
          resolve(list.filter(item => 
            item && 
            item.id && 
            item.category !== 'vip_client' && 
            !item.id?.startsWith('vip-') && 
            !item.category?.endsWith('_data') && 
            !item.id?.startsWith('system_') && 
            !item.id?.startsWith('book-') && 
            !item.id?.startsWith('pay-') && 
            !item.id?.startsWith('rev-') && 
            !item.id?.startsWith('sess-') && 
            typeof item.url === 'string' && 
            !item.url.trim().startsWith('{') && 
            !item.url.trim().startsWith('[') && 
            !item.url.includes('fbcdn.net')
          ));
        };
      });
    });
  } catch (e) {
    console.warn('Error al leer catálogo de IndexedDB:', e);
    return [];
  }
}

export async function idbSaveCatalogItem(item) {
  if (!item || !item.id) return false;
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        const tx = db.transaction(CATALOG_STORE, 'readwrite');
        const store = tx.objectStore(CATALOG_STORE);
        store.put(item);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    });
  } catch (e) {
    console.warn('Error al guardar foto en IndexedDB:', e);
    return false;
  }
}

export async function idbSaveCatalogBatch(items) {
  if (!Array.isArray(items) || items.length === 0) return false;
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        const tx = db.transaction(CATALOG_STORE, 'readwrite');
        const store = tx.objectStore(CATALOG_STORE);
        for (const item of items) {
          if (item && item.id) store.put(item);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    });
  } catch (e) {
    console.warn('Error al guardar lote en IndexedDB:', e);
    return false;
  }
}

export async function idbDeleteCatalogItem(id) {
  if (!id) return false;
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        const tx = db.transaction(CATALOG_STORE, 'readwrite');
        const store = tx.objectStore(CATALOG_STORE);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    });
  } catch (e) {
    console.warn('Error al eliminar foto de IndexedDB:', e);
    return false;
  }
}

export async function idbGetSessions() {
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        const tx = db.transaction(SESSIONS_STORE, 'readonly');
        const store = tx.objectStore(SESSIONS_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      });
    });
  } catch (e) {
    console.warn('Error al leer sesiones de IndexedDB:', e);
    return [];
  }
}

export async function idbSaveSession(session) {
  if (!session || !session.id) return false;
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        const tx = db.transaction(SESSIONS_STORE, 'readwrite');
        const store = tx.objectStore(SESSIONS_STORE);
        store.put(session);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    });
  } catch (e) {
    console.warn('Error al guardar sesión en IndexedDB:', e);
    return false;
  }
}

export async function idbDeleteSession(id) {
  if (!id) return false;
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        const tx = db.transaction(SESSIONS_STORE, 'readwrite');
        const store = tx.objectStore(SESSIONS_STORE);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    });
  } catch (e) {
    console.warn('Error al eliminar sesión de IndexedDB:', e);
    return false;
  }
}

// --- BLINDAJE DE RESERVAS EN INDEXEDDB (BÓVEDA INMUTABLE) ---
export async function idbGetBookings() {
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(BOOKINGS_STORE)) return resolve([]);
        const tx = db.transaction(BOOKINGS_STORE, 'readonly');
        const store = tx.objectStore(BOOKINGS_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      });
    });
  } catch (e) {
    return [];
  }
}

export async function idbSaveBooking(booking) {
  if (!booking || !booking.id) return false;
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(BOOKINGS_STORE)) return resolve(false);
        const tx = db.transaction(BOOKINGS_STORE, 'readwrite');
        const store = tx.objectStore(BOOKINGS_STORE);
        store.put(booking);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    });
  } catch (e) {
    return false;
  }
}

export async function idbSaveBookingsBatch(bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) return false;
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(BOOKINGS_STORE)) return resolve(false);
        const tx = db.transaction(BOOKINGS_STORE, 'readwrite');
        const store = tx.objectStore(BOOKINGS_STORE);
        for (const b of bookings) {
          if (b && b.id) store.put(b);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    });
  } catch (e) {
    return false;
  }
}

export async function idbDeleteBooking(id) {
  if (!id) return false;
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(BOOKINGS_STORE)) return resolve(true);
        const tx = db.transaction(BOOKINGS_STORE, 'readwrite');
        const store = tx.objectStore(BOOKINGS_STORE);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    });
  } catch (e) {
    return false;
  }
}

// --- BLINDAJE DE CLIENTES VIP EN INDEXEDDB ---
export async function idbGetVipClients() {
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(VIP_CLIENTS_STORE)) return resolve([]);
        const tx = db.transaction(VIP_CLIENTS_STORE, 'readonly');
        const store = tx.objectStore(VIP_CLIENTS_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      });
    });
  } catch (e) {
    return [];
  }
}

export async function idbSaveVipClient(client) {
  if (!client || !client.id) return false;
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(VIP_CLIENTS_STORE)) return resolve(false);
        const tx = db.transaction(VIP_CLIENTS_STORE, 'readwrite');
        const store = tx.objectStore(VIP_CLIENTS_STORE);
        store.put(client);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    });
  } catch (e) {
    return false;
  }
}

export async function idbSaveVipClientsBatch(clients) {
  if (!Array.isArray(clients) || clients.length === 0) return false;
  try {
    return await withDB((db) => {
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(VIP_CLIENTS_STORE)) return resolve(false);
        const tx = db.transaction(VIP_CLIENTS_STORE, 'readwrite');
        const store = tx.objectStore(VIP_CLIENTS_STORE);
        for (const c of clients) {
          if (c && c.id) store.put(c);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    });
  } catch (e) {
    return false;
  }
}

