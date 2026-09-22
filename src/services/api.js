import { supabase } from './supabase';

const API_BASE = '/api';
const LOCAL_SESSIONS_KEY = 'sebastian_g_sessions_v1';
const LOCAL_BOOKINGS_KEY = 'sebastian_g_bookings_v1';
const LOCAL_CATALOG_KEY = 'sebastian_g_catalog_v1';
const LOCAL_DELETED_CATALOG_KEY = 'sebastian_g_deleted_catalog_ids_v2';
const LOCAL_SAMPLES_PURGED_KEY = 'sebastian_g_samples_purged_v1';
const LOCAL_PIN_KEY = 'sebastian_g_admin_pin';
const LOCAL_PACKAGES_KEY = 'sebastian_g_packages_v1';
const LOCAL_SETTINGS_KEY = 'sebastian_g_settings_v1';

const SAMPLE_PHOTO_IDS = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-8', 'cat-atardecer-covenas'];

export const DEFAULT_PACKAGES = [
  {
    id: "pkg-4fotos",
    name: "4 Fotos Digitales",
    price: 45000,
    photoCount: 4,
    freePhotos: 2,
    totalPhotos: 6,
    duration: "45 minutos",
    outfits: "1 a 2 cambios",
    description: "Ideal para fotos individuales, retratos en playa o sesión casual.",
    features: [
      "4 Fotos Digitales en Alta Calidad",
      "+ 2 Fotos GRATIS incluidas (Total: 6 fotos)",
      "Edición y retoque profesional",
      "Atención personalizada",
      "Enlace privado de WhatsApp para elegir tus favoritas"
    ],
    popular: false
  },
  {
    id: "pkg-6fotos",
    name: "6 Fotos Digitales",
    price: 65000,
    photoCount: 6,
    freePhotos: 2,
    totalPhotos: 8,
    duration: "1 hora",
    outfits: "2 cambios de vestuario",
    description: "Perfecto para parejas, cumpleaños o retratos con variedad de poses.",
    features: [
      "6 Fotos Digitales en Alta Calidad",
      "+ 2 Fotos GRATIS incluidas (Total: 8 fotos)",
      "Edición y retoque profesional",
      "Atención personalizada",
      "Enlace privado de WhatsApp con 3 días para seleccionar"
    ],
    popular: false
  },
  {
    id: "pkg-8fotos",
    name: "8 Fotos Digitales",
    price: 75000,
    photoCount: 8,
    freePhotos: 2,
    totalPhotos: 10,
    duration: "1 hora y media",
    outfits: "2 a 3 cambios",
    description: "Nuestra opción favorita para familias, quinceañeras y atardeceres frente al mar.",
    features: [
      "8 Fotos Digitales en Alta Calidad",
      "+ 2 Fotos GRATIS incluidas (Total: 10 fotos)",
      "Edición profesional detallada",
      "Asesoría de poses en locación",
      "Selección exclusiva mediante enlace protegido"
    ],
    popular: true
  },
  {
    id: "pkg-10fotos",
    name: "10 Fotos Digitales",
    price: 85000,
    photoCount: 10,
    freePhotos: 2,
    totalPhotos: 12,
    duration: "Hasta 2 horas",
    outfits: "Cambios ilimitados",
    description: "Cobertura completa con fotos variadas de plano entero, medio cuerpo y primeros planos.",
    features: [
      "10 Fotos Digitales en Alta Calidad",
      "+ 2 Fotos GRATIS incluidas (Total: 12 fotos)",
      "Edición y colorización profesional cinematográfica",
      "Prioridad de entrega",
      "Opción de añadir impresiones 10x15 a $7.000 c/u"
    ],
    popular: false
  }
];

export const DEFAULT_REAL_CATALOG = [
  { id: 'cat-verano-salsero', title: 'Verano salsero', category: 'Retratos', location: 'Playas de Coveñas', url: '/catalog/verano-salsero.jpg' },
  { id: 'cat-1789878355199', title: 'Amor al campo', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789878355199.jpg' },
  { id: 'cat-1789902452640', title: 'Atardecer', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789902452640.jpg' },
  { id: 'cat-1789916017066', title: 'Feliz cumpleaños Thiago', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789916017066.jpg' },
  { id: 'cat-1789916075257', title: 'Atardeceres', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789916075257.jpg' },
  { id: 'cat-1789916145830', title: 'Morenas con estilo', category: 'Retratos', location: 'Malecón, San Antero', url: '/catalog/cat-1789916145830.jpg' },
  { id: 'cat-1789916197806', title: 'Unión Familiar', category: 'Retratos', location: 'Tijereta, San Antero', url: '/catalog/cat-1789916197806.jpg' },
  { id: 'cat-1789916408679', title: 'Feliz cumpleaños Kairys', category: 'Playas & Atardeceres', location: 'Playa Blanca, San Antero', url: '/catalog/cat-1789916408679.jpg' },
  { id: 'cat-1789916617329', title: 'ANGT', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789916617329.jpg' },
  { id: 'cat-1789949201412', title: 'Feliz cumpleaños Daniela', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789949201412.jpg' },
  { id: 'cat-1789949301568', title: 'Jesús, un niño lleno de alegría', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789949301568.jpg' },
  { id: 'cat-1789949471911', title: 'Feliz cumpleaños Julieta', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789949471911.jpg' },
  { id: 'cat-1789951307326', title: 'Los 6 años de Christy', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789951307326.jpg' },
  { id: 'cat-1789951453602', title: 'Felices 16', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789951453602.jpg' },
  { id: 'cat-1789951546306', title: 'Los 9 meses de Celeste', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789951546306.jpg' },
  { id: 'cat-1789951644266', title: 'celebramos un cumpleaños rodeado de la magia  Ayda Luz', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789951644266.jpg' },
  { id: 'cat-1789951931767', title: 'Una sesión llena de amor, ilusión', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789951931767.jpg' },
  { id: 'cat-1789952024846', title: 'Feliz primer cumpleaños, Shamara', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789952024846.jpg' }
];

export function isSampleItem(item) {
  if (!item) return false;
  if (SAMPLE_PHOTO_IDS.includes(item.id)) return true;
  if (typeof item.url === 'string' && item.url.includes('images.unsplash.com')) return true;
  return false;
}

export function getDeletedCatalogIds() {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_CATALOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function addDeletedCatalogId(id) {
  try {
    const ids = getDeletedCatalogIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(LOCAL_DELETED_CATALOG_KEY, JSON.stringify(ids));
    }
  } catch (e) {}
}

const DEFAULT_SETTINGS = {
  photographerName: "Sebastian G",
  photographerWhatsApp: "+573244725167",
  photographerWhatsApp2: "+573023696513",
  outOfSanAnteroSurcharge: 10000,
  currencySymbol: "$",
  tagline: "Capturamos momentos, creamos recuerdos. ♡",
  watermarkText: "SEBASTIAN G",
  watermarkSubtext: "MUESTRA EXCLUSIVA • PROHIBIDA SU DESCARGA",
  watermarkLogoUrl: "/app-icon.png",
  adminPin: "0493",
  printedPhotoPrice: 7000
};

// Helpers de almacenamiento local de respaldo
function getLocalCatalog() {
  try {
    const raw = localStorage.getItem(LOCAL_CATALOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveLocalCatalogItem(item) {
  try {
    const items = getLocalCatalog().filter(i => i.id !== item.id);
    items.unshift(item);
    localStorage.setItem(LOCAL_CATALOG_KEY, JSON.stringify(items));
    // Si estaba en la lista de eliminados, removerlo porque se está agregando de nuevo
    try {
      const deletedIds = getDeletedCatalogIds().filter(id => id !== item.id);
      localStorage.setItem(LOCAL_DELETED_CATALOG_KEY, JSON.stringify(deletedIds));
    } catch (e) {}
  } catch (e) {
    console.warn('No se pudo guardar item de catálogo:', e);
  }
}

function removeLocalCatalogItem(id) {
  try {
    addDeletedCatalogId(id);
    const items = getLocalCatalog().filter(i => i.id !== id);
    localStorage.setItem(LOCAL_CATALOG_KEY, JSON.stringify(items));
  } catch (e) {}
}

// Helpers de almacenamiento local de respaldo
function getLocalSessions() {
  try {
    const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const filtered = (Array.isArray(list) ? list : []).filter(
      s => s && s.clientName !== 'Camila Rodríguez' && s.id !== 'sess-demo' && s.token !== 'demo-cliente-2026'
    );
    if (filtered.length !== list.length) {
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch (e) {
    return [];
  }
}

function saveLocalSession(session) {
  if (!session || session.clientName === 'Camila Rodríguez' || session.token === 'demo-cliente-2026' || session.id === 'sess-demo') {
    return;
  }
  try {
    const sessions = getLocalSessions().filter(s => s.id !== session.id && s.token !== session.token);
    sessions.unshift(session);
    try {
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (quotaErr) {
      // Si el almacenamiento local está cerca del límite de 5MB, conservar solo las 3 sesiones más recientes
      console.warn('Límite de almacenamiento alcanzado, recortando sesiones antiguas:', quotaErr);
      const trimmed = sessions.slice(0, 3);
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(trimmed));
    }
  } catch (e) {
    console.warn('No se pudo guardar en localStorage:', e);
  }
}

export const REAL_DEFAULT_BOOKINGS = [
  {
    id: "book-real-jennifer-vasquez",
    clientName: "Jennifer Vásquez",
    clientWhatsApp: "+57 320 892 1635",
    packageId: "pkg-8fotos",
    packageName: "8 Fotos Digitales (+ 2 Fotos Gratis)",
    totalPrice: 85000,
    locationType: "outside_san_antero",
    specificLocation: "Coveñas",
    dateTime: "30/09/2026 a las 3:00 p. m.",
    description: "Sesión de fotos de juramento de bandera de su hijo",
    createdAt: "2026-09-19T10:00:00.000Z",
    status: "confirmed",
    isReal: true
  }
];

export function formatTo12Hour(time24) {
  if (!time24) return '';
  if (/a\.?\s*m\.?|p\.?\s*m\.?/i.test(time24)) return time24;
  const match = time24.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time24;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function formatDateTime12Hour(dateTimeStr) {
  if (!dateTimeStr) return '';
  if (/a\.?\s*m\.?|p\.?\s*m\.?/i.test(dateTimeStr)) return dateTimeStr;
  if (dateTimeStr.includes(' a las ')) {
    const [datePart, timePart] = dateTimeStr.split(' a las ');
    return `${datePart} a las ${formatTo12Hour(timePart)}`;
  }
  if (dateTimeStr.includes('T')) {
    const [datePart, timePart] = dateTimeStr.split('T');
    return `${datePart} a las ${formatTo12Hour(timePart)}`;
  }
  return formatTo12Hour(dateTimeStr);
}

const LOCAL_PAYMENTS_KEY = 'sebastian_g_payments_v1';
const LOCAL_REVIEWS_KEY = 'sebastian_g_reviews_v1';
const LOCAL_WALLET_BASE_BALANCES_KEY = 'sebastian_g_wallet_base_balances_v1';

export const REAL_DEFAULT_REVIEWS = [];

export function getLocalReviews() {
  try {
    const raw = localStorage.getItem(LOCAL_REVIEWS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) {
      // Filtrar y eliminar de inmediato cualquier comentario de muestra no real
      const clean = list.filter(r => r && r.id && !r.id.startsWith('rev-jennifer-vasquez') && !r.id.startsWith('rev-ayda-luz') && !r.id.startsWith('rev-shamara'));
      if (clean.length !== list.length) {
        localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(clean));
      }
      return clean;
    }
  } catch (e) {}
  return [];
}

export function saveLocalReview(review) {
  try {
    const list = getLocalReviews().filter(r => r.id !== review.id);
    list.unshift(review);
    localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(list));
    localStorage.setItem('sebastian_g_reviews_last_sync', Date.now().toString());
  } catch (e) {
    console.warn('No se pudo guardar reseña en localStorage:', e);
  }
}

export function getWalletBaseBalances() {
  try {
    const raw = localStorage.getItem(LOCAL_WALLET_BASE_BALANCES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { nequi: 0, daviplata: 0, dale: 0 };
}

export function saveWalletBaseBalances(balances) {
  try {
    localStorage.setItem(LOCAL_WALLET_BASE_BALANCES_KEY, JSON.stringify(balances));
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      const bc = new BroadcastChannel('wallet_balances_sync');
      bc.postMessage({ type: 'BALANCES_UPDATED', balances });
      setTimeout(() => bc.close(), 300);
    }
  } catch (e) {}
}

function getLocalPayments() {
  try {
    const raw = localStorage.getItem(LOCAL_PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalPayment(payment) {
  try {
    const payments = getLocalPayments().filter(p => p.id !== payment.id);
    payments.unshift(payment);
    localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(payments));
    localStorage.setItem('sebastian_g_payments_last_sync', Date.now().toString());
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        const bc = new BroadcastChannel('payments_realtime_sync');
        bc.postMessage({ type: 'new_payment', payment });
        setTimeout(() => bc.close(), 300);
      }
    } catch (e) {}
  } catch (e) {
    console.warn('No se pudo guardar pago en localStorage:', e);
  }
}

function getLocalBookings() {
  try {
    const raw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
    let list = raw ? JSON.parse(raw) : [];
    // Filtrar cualquier reserva de muestra o demo que haya quedado guardada
    list = (Array.isArray(list) ? list : []).filter(b => b && b.clientName !== 'Camila Rodríguez' && b.id !== 'book-demo-1');
    
    // Asegurar que Jennifer Vásquez esté siempre presente con sus datos reales del 30 de septiembre
    let found = false;
    list = list.map(b => {
      if (b.id === 'book-real-jennifer-vasquez' || b.clientName === 'Jennifer Vásquez') {
        found = true;
        return {
          ...b,
          id: "book-real-jennifer-vasquez",
          clientName: "Jennifer Vásquez",
          clientWhatsApp: "+57 320 892 1635",
          packageId: "pkg-8fotos",
          packageName: "8 Fotos Digitales (+ 2 Fotos Gratis)",
          totalPrice: 85000,
          locationType: "outside_san_antero",
          specificLocation: "Coveñas",
          dateTime: "30/09/2026 a las 3:00 p. m.",
          description: "Sesión de fotos de juramento de bandera de su hijo",
          status: b.status || "confirmed",
          isReal: true
        };
      }
      return b;
    });

    if (!found) {
      list.unshift(...REAL_DEFAULT_BOOKINGS);
    }
    try {
      localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(list));
    } catch (e) {}
    return list;
  } catch (e) {
    return REAL_DEFAULT_BOOKINGS;
  }
}

function saveLocalBooking(booking) {
  try {
    const bookings = getLocalBookings().filter(b => b.id !== booking.id && b.clientName !== 'Camila Rodríguez');
    bookings.unshift(booking);
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(bookings));
    localStorage.setItem('sebastian_g_bookings_last_sync', Date.now().toString());
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        const bc = new BroadcastChannel('bookings_realtime_sync');
        bc.postMessage({ type: 'new_booking', booking });
        setTimeout(() => bc.close(), 300);
      }
    } catch (e) {}
  } catch (e) {
    console.warn('No se pudo guardar booking en localStorage:', e);
  }
}

function getLocalPackages() {
  try {
    const raw = localStorage.getItem(LOCAL_PACKAGES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveLocalPackages(pkgs) {
  try {
    localStorage.setItem(LOCAL_PACKAGES_KEY, JSON.stringify(pkgs));
  } catch (e) {
    console.warn('No se pudo guardar paquetes en localStorage:', e);
  }
}

function getLocalSettings() {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveLocalSettings(st) {
  try {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(st));
  } catch (e) {
    console.warn('No se pudo guardar settings en localStorage:', e);
  }
}

export async function getSettings() {
  const localSt = getLocalSettings();
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (res.ok) {
      const data = await res.json();
      return { ...DEFAULT_SETTINGS, ...data, ...(localSt || {}) };
    }
  } catch (err) {
    console.warn('Usando configuración por defecto o local:', err);
  }
  return { ...DEFAULT_SETTINGS, ...(localSt || {}) };
}

export async function updateSettings(newSettings) {
  saveLocalSettings(newSettings);
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
    if (res.ok) {
      const data = await res.json();
      return data.settings;
    }
  } catch (err) {
    console.warn('Servidor offline al guardar settings, guardado localmente:', err);
  }
  return newSettings;
}

const KNOWN_STATIC_PHOTOS = {
  'cat-verano-salsero': '/catalog/verano-salsero.jpg',
  'cat-1789878355199': '/catalog/cat-1789878355199.jpg',
  'cat-1789902452640': '/catalog/cat-1789902452640.jpg',
  'cat-1789916017066': '/catalog/cat-1789916017066.jpg',
  'cat-1789916075257': '/catalog/cat-1789916075257.jpg',
  'cat-1789916145830': '/catalog/cat-1789916145830.jpg',
  'cat-1789916197806': '/catalog/cat-1789916197806.jpg',
  'cat-1789916408679': '/catalog/cat-1789916408679.jpg',
  'cat-1789916617329': '/catalog/cat-1789916617329.jpg',
  'cat-1789949201412': '/catalog/cat-1789949201412.jpg',
  'cat-1789949301568': '/catalog/cat-1789949301568.jpg',
  'cat-1789949471911': '/catalog/cat-1789949471911.jpg',
  'cat-1789951307326': '/catalog/cat-1789951307326.jpg',
  'cat-1789951453602': '/catalog/cat-1789951453602.jpg',
  'cat-1789951546306': '/catalog/cat-1789951546306.jpg',
  'cat-1789951644266': '/catalog/cat-1789951644266.jpg',
  'cat-1789951931767': '/catalog/cat-1789951931767.jpg',
  'cat-1789952024846': '/catalog/cat-1789952024846.jpg'
};

export async function getCatalog() {
  let supabaseCatalog = [];
  try {
    const supabasePromise = supabase
      .from('catalog')
      .select('*')
      .order('created_at', { ascending: false });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase catalog timeout')), 2500)
    );
    const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);
    if (!error && Array.isArray(data)) {
      supabaseCatalog = data;
    }
  } catch (err) {
    console.warn('Aviso: Supabase catálogo no respondió a tiempo o error, usando caché y servidor:', err);
  }

  let serverCatalog = [];
  try {
    const res = await fetch(`${API_BASE}/catalog`);
    if (res.ok) {
      const data = await res.json();
      serverCatalog = Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.warn('Error obteniendo catálogo de servidor:', err);
  }

  const rawLocal = getLocalCatalog();
  const localItems = Array.isArray(rawLocal) ? rawLocal : [];
  const rawDeleted = getDeletedCatalogIds();
  const deletedIds = new Set(Array.isArray(rawDeleted) ? rawDeleted : []);
  const samplesPurged = localStorage.getItem(LOCAL_SAMPLES_PURGED_KEY) === 'true';

  // AUTO-SYNC INTELIGENTE: Si en este dispositivo hay fotos en localItems que no están en Supabase, sincronizarlas automáticamente
  if (localItems.length > 0) {
    setTimeout(async () => {
      try {
        for (const localItem of localItems) {
          if (!localItem || !localItem.id || deletedIds.has(localItem.id)) continue;
          const norm = (localItem.title || '').trim().toLowerCase();
          const exists = supabaseCatalog.some(s => 
            s.id === localItem.id || (s.title && s.title.trim().toLowerCase() === norm)
          );
          if (!exists && localItem.url && localItem.title) {
            await supabase.from('catalog').insert({
              id: String(localItem.id),
              title: localItem.title.trim(),
              category: localItem.category || 'Retratos',
              location: localItem.location || 'San Antero',
              url: localItem.url
            });
            console.log('✓ Foto sincronizada a Supabase en la nube:', localItem.title);
          }
        }
      } catch (e) {
        console.warn('Error en auto-sync a Supabase:', e);
      }
    }, 1200);
  }

  // Fuentes combinadas y deduplicadas inteligentemente:
  // Supabase -> Local -> Servidor -> Catálogo base predeterminado
  const allCandidates = [
    ...supabaseCatalog, 
    ...localItems, 
    ...serverCatalog, 
    ...DEFAULT_REAL_CATALOG
  ];

  const result = [];
  const seenIds = new Set();
  const seenTitles = new Set();

  for (let item of allCandidates) {
    if (!item || !item.id) continue;
    // Si el item es la captura defectuosa de muestra, descartarla
    if (item.id === 'cat-atardecer-covenas') continue;
    // Si el item fue eliminado por el usuario, descartarlo
    if (deletedIds.has(item.id)) continue;
    // Si las muestras demo fueron purgadas y es foto demo de Unsplash, descartarlo
    if (samplesPurged && isSampleItem(item)) continue;

    // Sustituir base64 pesado o enlaces externos lentos por archivo estático ultrarrápido
    if (KNOWN_STATIC_PHOTOS[item.id]) {
      item = { ...item, url: KNOWN_STATIC_PHOTOS[item.id] };
    }

    // Normalizar título para deduplicar fotos con el mismo nombre
    const normTitle = (item.title || '').trim().toLowerCase();
    
    // Si ya existe por ID o por título exacto, es duplicada: descartar
    if (seenIds.has(item.id)) continue;
    if (normTitle && seenTitles.has(normTitle)) continue;

    seenIds.add(item.id);
    if (normTitle) seenTitles.add(normTitle);
    result.push(item);
  }

  // Saneamiento automático en localStorage del celular para eliminar duplicados residuales
  try {
    const cleanLocal = [];
    const localTitles = new Set();
    localItems.forEach(i => {
      if (!i || !i.id || deletedIds.has(i.id)) return;
      const t = (i.title || '').trim().toLowerCase();
      if (t && localTitles.has(t)) return;
      if (t) localTitles.add(t);
      cleanLocal.push(i);
    });
    if (cleanLocal.length !== localItems.length) {
      localStorage.setItem(LOCAL_CATALOG_KEY, JSON.stringify(cleanLocal));
    }
  } catch (e) {}

  return result.length > 0 ? result : DEFAULT_REAL_CATALOG;
}

export async function getPackages() {
  const localPkgs = getLocalPackages();
  try {
    const res = await fetch(`${API_BASE}/packages`);
    if (res.ok) {
      const serverPkgs = await res.json();
      if (Array.isArray(serverPkgs) && serverPkgs.length > 0) {
        return serverPkgs;
      }
    }
  } catch (err) {
    console.warn('Aviso: Servidor /api/packages inaccesible, usando local/defecto:', err);
  }
  if (localPkgs && Array.isArray(localPkgs) && localPkgs.length > 0) {
    return localPkgs;
  }
  return DEFAULT_PACKAGES;
}

export async function updatePackages(packages) {
  saveLocalPackages(packages);
  try {
    const res = await fetch(`${API_BASE}/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packages })
    });
    if (res.ok) {
      const data = await res.json();
      return data.packages;
    }
  } catch (err) {
    console.warn('Servidor offline al guardar paquetes, guardado localmente:', err);
  }
  return packages;
}

export async function createBooking(data) {
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const result = await res.json();
      saveLocalBooking(result.booking);
      return result;
    }
  } catch (err) {
    console.warn('Server offline o error al reservar, usando fallback seguro:', err);
  }

  // Fallback local garantizado
  const newBooking = {
    id: `book-${Date.now()}`,
    ...data,
    totalPrice: data.totalPrice || 75000,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
  saveLocalBooking(newBooking);

  const p1 = (DEFAULT_SETTINGS.photographerWhatsApp).replace(/\D/g, '');
  const p2 = (DEFAULT_SETTINGS.photographerWhatsApp2).replace(/\D/g, '');
  const msg = encodeURIComponent(
    `📸 *¡Hola Sebastian G! Acabo de hacer una reserva en tu sitio web:*\n\n` +
    `👤 *Nombre:* ${newBooking.clientName}\n` +
    `📱 *WhatsApp:* ${newBooking.clientWhatsApp}\n` +
    `📦 *Paquete:* ${newBooking.packageName || 'Sesión Fotográfica'} ($${Number(newBooking.totalPrice || 0).toLocaleString('es-CO')} COP)\n` +
    `📍 *Lugar:* ${newBooking.specificLocation || 'San Antero'}\n` +
    `🗓️ *Fecha y Hora:* ${newBooking.dateTime}\n` +
    `📝 *Detalles:* ${newBooking.description || 'Sin notas adicionales'}\n\n` +
    `_Quedo atento a tu confirmación para agendarla definitivamente._`
  );

  return {
    success: true,
    booking: newBooking,
    directWhatsAppUrl: `https://wa.me/${p1}?text=${msg}`,
    secondaryWhatsAppUrl: `https://wa.me/${p2}?text=${msg}`
  };
}

export async function getGalleryByToken(token) {
  try {
    const res = await fetch(`${API_BASE}/gallery/${token}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.clientName !== 'Camila Rodríguez' && token !== 'demo-cliente-2026') {
        saveLocalSession(data);
      }
      return {
        ...data,
        isDelivered: data.status === 'delivered'
      };
    }
  } catch (err) {
    console.warn('Error conectando con servidor para galería, consultando local:', err);
  }

  // Si es la demostración pública para visitantes, proveer datos limpios
  if (token === 'demo-cliente-2026') {
    return {
      id: "sess-demo",
      token: "demo-cliente-2026",
      clientName: "Demostración de Selección",
      clientWhatsApp: "+573244725167",
      packageTitle: "8 Fotos Digitales (+ 2 Fotos Gratis)",
      maxPhotosAllowed: 10,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "pending",
      submittedAt: null,
      isExpired: false,
      isSubmitted: false,
      isDelivered: false,
      timeRemainingMs: 30 * 24 * 60 * 60 * 1000,
      photos: [
        { id: "photo-1", title: "Foto 001 - Retrato Primer Plano", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-2", title: "Foto 002 - Mirada al Atardecer", url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-3", title: "Foto 003 - Sonrisa en la Orilla", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-4", title: "Foto 004 - Movimiento y Brisa", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-5", title: "Foto 005 - Plano Entero en la Playa", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-6", title: "Foto 006 - Silueta en Contraluz", url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" }
      ],
      watermarkSettings: {
        watermarkText: DEFAULT_SETTINGS.watermarkText,
        watermarkSubtext: DEFAULT_SETTINGS.watermarkSubtext,
        watermarkLogoUrl: DEFAULT_SETTINGS.watermarkLogoUrl
      }
    };
  }

  // Buscar en fallback local
  const local = getLocalSessions().find(s => s.token === token);
  if (local) {
    const now = Date.now();
    const expiresTime = new Date(local.expiresAt).getTime();
    return {
      ...local,
      isExpired: now > expiresTime,
      isSubmitted: local.status === 'submitted' || local.status === 'delivered',
      isDelivered: local.status === 'delivered',
      timeRemainingMs: Math.max(0, expiresTime - now),
      watermarkSettings: {
        watermarkText: DEFAULT_SETTINGS.watermarkText,
        watermarkSubtext: DEFAULT_SETTINGS.watermarkSubtext,
        watermarkLogoUrl: DEFAULT_SETTINGS.watermarkLogoUrl
      }
    };
  }

  throw new Error('Galería no encontrada o enlace inválido.');
}

export async function submitGallerySelection(token, selections) {
  let serverResult = null;
  try {
    const res = await fetch(`${API_BASE}/gallery/${token}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selections })
    });
    if (res.ok) {
      serverResult = await res.json();
    }
  } catch (err) {
    console.warn('Error en servidor al enviar selección, procesando localmente:', err);
  }

  // Actualizar también en localStorage
  const localSessions = getLocalSessions();
  const session = localSessions.find(s => s.token === token);

  const selMap = new Map();
  (selections || []).forEach(item => {
    selMap.set(item.id, {
      selected: Boolean(item.selected),
      comment: (item.clientComment || '').trim()
    });
  });

  let clientName = "Cliente";
  let packageTitle = "Sesión Fotográfica";
  let selectedPhotos = [];

  if (session) {
    session.photos = session.photos.map(p => {
      const u = selMap.get(p.id);
      return u ? { ...p, selected: u.selected, clientComment: u.comment } : p;
    });
    session.status = 'submitted';
    session.submittedAt = new Date().toISOString();
    saveLocalSession(session);

    clientName = session.clientName;
    packageTitle = session.packageTitle;
    selectedPhotos = session.photos.filter(p => p.selected);
  } else {
    selectedPhotos = selections.filter(s => s.selected);
  }

  // Generar texto resumen impecable para WhatsApp
  let summary = `📸 *¡Hola Sebastian G! Ya elegí las fotos de mi sesión:*\n\n`;
  summary += `👤 *Cliente:* ${clientName}\n`;
  summary += `📦 *Sesión:* ${packageTitle}\n`;
  summary += `🔢 *Total Elegidas:* ${selectedPhotos.length} fotos\n\n`;
  summary += `*Lista de fotos seleccionadas:*\n`;

  selectedPhotos.forEach((p, idx) => {
    const title = p.title || `Foto #${idx + 1}`;
    const note = p.clientComment || p.comment;
    summary += `\n${idx + 1}. *${title}*`;
    if (note) {
      summary += `\n   💬 _Nota:_ "${note}"`;
    }
  });

  summary += `\n\n_Quedo atento(a) a la entrega final en alta resolución. ¡Muchas gracias!_`;

  const p1 = (DEFAULT_SETTINGS.photographerWhatsApp).replace(/\D/g, '');
  const p2 = (DEFAULT_SETTINGS.photographerWhatsApp2).replace(/\D/g, '');
  const directWhatsAppUrl = `https://wa.me/${p1}?text=${encodeURIComponent(summary)}`;
  const secondaryWhatsAppUrl = `https://wa.me/${p2}?text=${encodeURIComponent(summary)}`;

  return {
    success: true,
    message: '¡Selección guardada y bloqueada con éxito!',
    selectedCount: selectedPhotos.length,
    directWhatsAppUrl: serverResult?.directWhatsAppUrl || directWhatsAppUrl,
    secondaryWhatsAppUrl: serverResult?.secondaryWhatsAppUrl || secondaryWhatsAppUrl,
    summary: serverResult?.summaryText || serverResult?.summary || summary
  };
}

export async function verifyAdminPin(pin) {
  // Purga de seguridad: si localSavedPin quedó con el pin viejo '1234', lo eliminamos
  let localSavedPin = localStorage.getItem(LOCAL_PIN_KEY);
  if (localSavedPin === '1234') {
    localStorage.removeItem(LOCAL_PIN_KEY);
    localSavedPin = null;
  }

  const cleanPin = String(pin || '').trim();

  try {
    const res = await fetch(`${API_BASE}/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: cleanPin })
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('Verificando PIN en modo offline:', err);
  }

  if (localSavedPin && cleanPin === localSavedPin && cleanPin !== '1234') {
    return { success: true, token: 'admin-authorized-token' };
  }

  if (cleanPin === DEFAULT_SETTINGS.adminPin) {
    return { success: true, token: 'admin-authorized-token' };
  }
  throw new Error('PIN incorrecto.');
}

export async function getAdminBookings() {
  let combined = [];
  try {
    const res = await fetch(`${API_BASE}/admin/bookings`);
    if (res.ok) {
      const data = await res.json();
      const local = getLocalBookings();
      const map = new Map();
      [...data, ...local].forEach(b => {
        if (b && b.id && b.clientName !== 'Camila Rodríguez' && b.id !== 'book-demo-1') {
          map.set(b.id, b);
        }
      });
      combined = Array.from(map.values());
    }
  } catch (err) {
    console.warn(err);
    combined = getLocalBookings();
  }

  if (combined.length === 0) {
    combined = [...REAL_DEFAULT_BOOKINGS];
  } else {
    // Asegurar que Jennifer siempre esté con sus datos correctos restaurados
    let hasJennifer = false;
    combined = combined.map(b => {
      if (b.id === 'book-real-jennifer-vasquez' || b.clientName === 'Jennifer Vásquez') {
        hasJennifer = true;
        return {
          ...b,
          id: "book-real-jennifer-vasquez",
          clientName: "Jennifer Vásquez",
          clientWhatsApp: "+57 320 892 1635",
          packageId: "pkg-8fotos",
          packageName: "8 Fotos Digitales (+ 2 Fotos Gratis)",
          totalPrice: 85000,
          locationType: "outside_san_antero",
          specificLocation: "Coveñas",
          dateTime: "30/09/2026 a las 3:00 p. m.",
          description: "Sesión de fotos de juramento de bandera de su hijo",
          status: b.status || "confirmed",
          isReal: true
        };
      }
      return b;
    });

    if (!hasJennifer) {
      combined.unshift(...REAL_DEFAULT_BOOKINGS);
    }
  }

  // Filtrar cualquier rastro de reservas demo
  return combined.filter(b => b && b.clientName !== 'Camila Rodríguez' && b.id !== 'book-demo-1');
}

export async function updateAdminBooking(id, updates) {
  try {
    const res = await fetch(`${API_BASE}/admin/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.booking) {
        saveLocalBooking(data.booking);
        return data;
      }
    }
  } catch (err) {
    console.warn('Error al actualizar reserva en servidor, guardando localmente:', err);
  }

  const list = getLocalBookings().map(b => b.id === id ? { ...b, ...updates } : b);
  try {
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(list));
  } catch (e) {}
  return { success: true, booking: list.find(b => b.id === id) };
}

export async function updateBookingStatus(id, status) {
  return updateAdminBooking(id, { status });
}

export async function deleteAdminBooking(id) {
  try {
    await fetch(`${API_BASE}/admin/bookings/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Error al eliminar reserva en servidor:', err);
  }

  const list = getLocalBookings().filter(b => b.id !== id);
  try {
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(list));
  } catch (e) {}
  return { success: true };
}

// --- PAGOS EN TIEMPO REAL (NEQUI, DAVIPLATA, DALE) ---
export async function getAdminPayments() {
  try {
    const res = await fetch(`${API_BASE}/admin/payments`);
    if (res.ok) {
      const serverPayments = await res.json();
      const localPayments = getLocalPayments();
      const map = new Map();
      [...serverPayments, ...localPayments].forEach(p => {
        if (p && p.id) map.set(p.id, p);
      });
      return Array.from(map.values());
    }
  } catch (err) {
    console.warn('Consultando pagos locales:', err);
  }
  return getLocalPayments();
}

export async function createPayment(paymentData) {
  let serverResult = null;
  try {
    const res = await fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    if (res.ok) {
      serverResult = await res.json();
      if (serverResult?.payment) {
        saveLocalPayment(serverResult.payment);
        return serverResult;
      }
    }
  } catch (err) {
    console.warn('Creando pago con respaldo local:', err);
  }

  // Fallback local garantizado
  const newPayment = {
    id: `pay-${Date.now()}`,
    clientName: (paymentData.clientName || 'Cliente').trim(),
    clientWhatsApp: (paymentData.clientWhatsApp || '').trim(),
    sessionToken: paymentData.sessionToken || '',
    packageTitle: paymentData.packageTitle || 'Sesión Fotográfica',
    amount: Number(paymentData.amount) || 0,
    method: paymentData.method || 'nequi',
    reference: (paymentData.reference || '').trim(),
    voucherUrl: paymentData.voucherUrl || null,
    extraPhotosCount: Number(paymentData.extraPhotosCount) || 0,
    printedPhotosCount: Number(paymentData.printedPhotosCount) || 0,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  saveLocalPayment(newPayment);

  const p1 = (DEFAULT_SETTINGS.photographerWhatsApp).replace(/\D/g, '');
  const p2 = (DEFAULT_SETTINGS.photographerWhatsApp2).replace(/\D/g, '');
  const methodNames = {
    nequi: 'Nequi (3244725167)',
    daviplata: 'DaviPlata (Llave @PLATA3244725167)',
    dale: 'Dale! (Llave @SGG04)'
  };
  const methodName = methodNames[newPayment.method] || newPayment.method;

  const msgText = encodeURIComponent(
    `💰 *¡Hola Sebastian G! Acabo de registrar mi pago de fotos:*\n\n` +
    `👤 *Cliente:* ${newPayment.clientName}\n` +
    `📱 *WhatsApp:* ${newPayment.clientWhatsApp}\n` +
    `💵 *Monto Transferido:* $${newPayment.amount.toLocaleString('es-CO')} COP\n` +
    `💳 *Pasarela / Billetera:* ${methodName}\n` +
    `🔢 *Referencia:* ${newPayment.reference || 'Comprobante adjunto'}\n` +
    `📸 *Detalle:* ${newPayment.extraPhotosCount} fotos extra elegidas` +
    (newPayment.printedPhotosCount > 0 ? ` + ${newPayment.printedPhotosCount} impresiones` : '') + `\n\n` +
    `_Comprobante registrado en la plataforma. ¡Por favor verifica mi pago!_`
  );

  return {
    success: true,
    payment: newPayment,
    directWhatsAppUrl: `https://wa.me/${p1}?text=${msgText}`,
    secondaryWhatsAppUrl: `https://wa.me/${p2}?text=${msgText}`
  };
}

export async function updatePaymentStatus(id, status) {
  try {
    const res = await fetch(`${API_BASE}/admin/payments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn(err);
  }

  const local = getLocalPayments().map(p => p.id === id ? { ...p, status } : p);
  localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(local));
  return { success: true };
}

// --- CALIFICACIONES & RESEÑAS DE SATISFACCIÓN (TESTIMONIOS) ---
export async function getReviews() {
  try {
    const res = await fetch(`${API_BASE}/reviews`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const clean = data.filter(r => r && r.id && !r.id.startsWith('rev-jennifer-vasquez') && !r.id.startsWith('rev-ayda-luz') && !r.id.startsWith('rev-shamara'));
        return clean;
      }
    }
  } catch (err) {
    console.warn('Consultando reseñas locales:', err);
  }

  return getLocalReviews();
}

export async function submitGalleryReview(token, reviewData) {
  let serverReview = null;
  try {
    const res = await fetch(`${API_BASE}/gallery/${token}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewData)
    });
    if (res.ok) {
      const data = await res.json();
      serverReview = data.review;
    }
  } catch (err) {
    console.warn('Error al guardar reseña en servidor, guardando local:', err);
  }

  const newReview = serverReview || {
    id: `rev-${Date.now()}`,
    clientName: (reviewData.clientName || 'Cliente').trim(),
    sessionTitle: reviewData.sessionTitle || 'Sesión Fotográfica',
    rating: Number(reviewData.rating) || 5,
    recommend: reviewData.recommend !== false,
    comment: (reviewData.comment || '').trim(),
    date: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    verified: true
  };

  saveLocalReview(newReview);

  try {
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      const bc = new BroadcastChannel('reviews_realtime_sync');
      bc.postMessage({ type: 'NEW_REVIEW', review: newReview, timestamp: Date.now() });
      setTimeout(() => bc.close(), 300);
    }
    localStorage.setItem('sebastian_g_reviews_last_sync', Date.now().toString());
  } catch (e) {}

  const p1 = (DEFAULT_SETTINGS.photographerWhatsApp).replace(/\D/g, '');
  const p2 = (DEFAULT_SETTINGS.photographerWhatsApp2).replace(/\D/g, '');
  const starsText = '⭐'.repeat(newReview.rating);
  const waMsg = encodeURIComponent(
    `🌟 *¡Hola Sebastian G! Acabo de calificar mi experiencia con tus fotos:*\n\n` +
    `👤 *Cliente:* ${newReview.clientName}\n` +
    `📦 *Sesión:* ${newReview.sessionTitle}\n` +
    `⭐ *Calificación:* ${starsText} (${newReview.rating}/5 Estrellas)\n` +
    `👍 *¿Nos recomienda?:* ${newReview.recommend ? '¡Sí, 100% recomendado!' : 'Sí'}\n` +
    `💬 *Comentario:* "${newReview.comment}"\n\n` +
    `_¡Muchísimas gracias por tu gran trabajo y profesionalismo!_`
  );

  return {
    success: true,
    review: newReview,
    directWhatsAppUrl: `https://wa.me/${p1}?text=${waMsg}`,
    secondaryWhatsAppUrl: `https://wa.me/${p2}?text=${waMsg}`
  };
}

// --- PROGRAMA DE FIDELIZACIÓN PARA CLIENTES RECURRENTES ---
export async function checkClientLoyalty(phone) {
  if (!phone) return { isLoyal: false, discountPercent: 0 };
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 7) return { isLoyal: false, discountPercent: 0 };

  try {
    const bookings = await getAdminBookings();
    const sessions = await getAdminSessions();

    const matchedBooking = bookings.find(b => {
      const bClean = (b.clientWhatsApp || '').replace(/\D/g, '');
      return bClean && (bClean.endsWith(clean.slice(-8)) || clean.endsWith(bClean.slice(-8)));
    });

    const matchedSession = sessions.find(s => {
      const sClean = (s.clientWhatsApp || '').replace(/\D/g, '');
      return sClean && (sClean.endsWith(clean.slice(-8)) || clean.endsWith(sClean.slice(-8)));
    });

    if (matchedBooking || matchedSession) {
      const clientName = matchedBooking?.clientName || matchedSession?.clientName || 'Cliente VIP';
      return {
        isLoyal: true,
        discountPercent: 15,
        clientName,
        previousSessions: 1
      };
    }
  } catch (e) {}

  return { isLoyal: false, discountPercent: 0 };
}

export async function getAdminSessions() {
  let serverSessions = [];
  try {
    const res = await fetch(`${API_BASE}/admin/sessions`);
    if (res.ok) {
      serverSessions = await res.json();
    }
  } catch (err) {
    console.warn('Consultando sesiones locales:', err);
  }

  const localSessions = getLocalSessions();
  const map = new Map();
  [...serverSessions, ...localSessions].forEach(s => {
    if (s && s.token && s.clientName !== 'Camila Rodríguez' && s.id !== 'sess-demo' && s.token !== 'demo-cliente-2026') {
      const now = Date.now();
      const expiresTime = new Date(s.expiresAt).getTime();
      map.set(s.token, {
        ...s,
        isExpired: now > expiresTime,
        selectedCount: s.photos ? s.photos.filter(p => p.selected).length : 0,
        totalPhotos: s.photos ? s.photos.length : 0
      });
    }
  });

  return Array.from(map.values());
}

export async function deleteAdminSession(id) {
  try {
    await fetch(`${API_BASE}/admin/sessions/${id}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.warn('Error al eliminar sesión en servidor:', err);
  }

  const sessions = getLocalSessions().filter(s => s.id !== id && s.token !== id);
  localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
  return { success: true };
}

export async function createAdminSession(data) {
  let serverResult = null;
  try {
    const res = await fetch(`${API_BASE}/admin/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      serverResult = await res.json();
      if (serverResult?.session) {
        saveLocalSession(serverResult.session);
        return serverResult;
      }
    }
  } catch (err) {
    console.warn('Creando sesión con respaldo local:', err);
  }

  // Fallback local seguro con token único y 3 días de vigencia
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const cleanName = (data.clientName || 'cliente').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15);
  const token = `${cleanName}-${Math.random().toString(36).substring(2, 8)}`;

  const newSession = {
    id: `sess-${Date.now()}`,
    token,
    clientName: (data.clientName || '').trim(),
    clientWhatsApp: (data.clientWhatsApp || '').trim(),
    packageTitle: data.packageTitle || 'Sesión Fotográfica',
    maxPhotosAllowed: Number(data.maxPhotosAllowed) || (data.photos?.length || 10),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'pending',
    submittedAt: null,
    photos: (data.photos || []).map((p, idx) => ({
      id: `photo-${Date.now()}-${idx + 1}`,
      title: p.title || `Foto #${idx + 1}`,
      url: p.url,
      selected: false,
      clientComment: ''
    }))
  };

  saveLocalSession(newSession);

  return {
    success: true,
    session: newSession,
    link: `/galeria/${token}`
  };
}

export async function reopenAdminSession(id, additionalDays = 3) {
  try {
    const res = await fetch(`${API_BASE}/admin/sessions/${id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ additionalDays })
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn(err);
  }

  const sessions = getLocalSessions().map(s => {
    if (s.id === id) {
      return {
        ...s,
        expiresAt: new Date(Date.now() + additionalDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        submittedAt: null
      };
    }
    return s;
  });
  localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
  return { success: true };
}

export async function deliverSession(id, deliveryData) {
  const { finalDeliveryUrl, deliveryService = 'wetransfer', deliveryNotes = '', finalPhotos = [] } = deliveryData;
  const now = new Date().toISOString();

  // 1. Servidor / Vercel
  try {
    const res = await fetch(`${API_BASE}/admin/sessions/${id}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalDeliveryUrl, deliveryService, deliveryNotes, finalPhotos })
    });
    if (res.ok) {
      const data = await res.json();
      const updated = getLocalSessions().map(s => {
        if (s.id === id || s.token === id) {
          return {
            ...s,
            status: 'delivered',
            finalDeliveryUrl,
            deliveryService,
            deliveryNotes,
            deliveredAt: now,
            ...(finalPhotos.length > 0 ? { finalPhotos } : {})
          };
        }
        return s;
      });
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(updated));
      return data;
    }
  } catch (err) {
    console.warn('Fallback local para entrega de fotos:', err);
  }

  // 2. Supabase si está disponible
  try {
    await supabase.from('sessions').update({
      status: 'delivered',
      final_delivery_url: finalDeliveryUrl,
      delivery_service: deliveryService,
      delivery_notes: deliveryNotes,
      delivered_at: now
    }).eq('id', id);
  } catch (e) {}

  // 3. Almacenamiento local persistente
  const updated = getLocalSessions().map(s => {
    if (s.id === id || s.token === id) {
      return {
        ...s,
        status: 'delivered',
        finalDeliveryUrl,
        deliveryService,
        deliveryNotes,
        deliveredAt: now,
        ...(finalPhotos.length > 0 ? { finalPhotos } : {})
      };
    }
    return s;
  });
  localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(updated));
  return {
    success: true,
    session: updated.find(s => s.id === id || s.token === id)
  };
}

export async function updateAdminSettings(settings, packages) {
  try {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings, packages })
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn(err);
  }
  return { success: true, settings, packages };
}

export function formatPhotoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();

  // Google Drive enlaces compartidos (ej: drive.google.com/file/d/ID/view o drive.google.com/open?id=ID)
  const gdriveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
  if (gdriveMatch && gdriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gdriveMatch[1]}`;
  }

  // Dropbox enlaces compartidos (dl=0 -> raw=1)
  if (url.includes('dropbox.com')) {
    return url.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1');
  }

  // Imgur enlaces directos
  const imgurMatch = url.match(/imgur\.com\/(?!gallery\/|a\/)([a-zA-Z0-9]+)$/);
  if (imgurMatch && imgurMatch[1]) {
    return `https://i.imgur.com/${imgurMatch[1]}.jpg`;
  }

  return url;
}

export function broadcastCatalogUpdate() {
  try {
    if (typeof window !== 'undefined') {
      if (window.BroadcastChannel) {
        const bc = new BroadcastChannel('catalog_realtime_sync');
        bc.postMessage({ type: 'CATALOG_UPDATED', timestamp: Date.now() });
        setTimeout(() => bc.close(), 200);
      }
      localStorage.setItem('sebastian_g_catalog_last_sync', Date.now().toString());
    }
  } catch (e) {}
}

export async function addCatalogPhoto(photoData) {
  const cleanUrl = formatPhotoUrl(photoData.url);
  const newItem = {
    id: `cat-${Date.now()}`,
    title: (photoData.title || '').trim(),
    category: (photoData.category || 'Retratos').trim(),
    location: (photoData.location || 'San Antero').trim(),
    url: cleanUrl
  };

  // 1. Guardar primero en Supabase en la nube
  try {
    const { data, error } = await supabase.from('catalog').insert(newItem).select();
    if (!error && data && data.length > 0) {
      saveLocalCatalogItem(data[0]);
      broadcastCatalogUpdate();
      return { success: true, item: data[0] };
    }
    if (error) console.warn('Supabase insert error:', error);
  } catch (err) {
    console.warn('Error insertando en Supabase:', err);
  }

  // 2. Fallback a servidor / Vercel
  try {
    const res = await fetch(`${API_BASE}/admin/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...photoData, url: cleanUrl })
    });
    if (res.ok) {
      const data = await res.json();
      saveLocalCatalogItem(data.item);
      broadcastCatalogUpdate();
      return data;
    }
  } catch (err) {
    console.warn('Fallback local para catálogo:', err);
  }

  // 3. Fallback a almacenamiento local
  saveLocalCatalogItem(newItem);
  broadcastCatalogUpdate();
  return { success: true, item: newItem };
}

export async function deleteCatalogPhoto(id, title = null) {
  addDeletedCatalogId(id);

  const local = getLocalCatalog();
  if (!title) {
    const found = local.find(i => i.id === id) || DEFAULT_REAL_CATALOG.find(i => i.id === id);
    if (found && found.title) title = found.title;
  }

  const normTitle = title ? title.trim().toLowerCase() : null;

  // 1. Borrar en Supabase en la nube
  try {
    await supabase.from('catalog').delete().eq('id', id);
    if (normTitle) {
      await supabase.from('catalog').delete().ilike('title', normTitle);
    }
  } catch (err) {
    console.warn('Error eliminando de Supabase:', err);
  }

  // 2. Borrar en almacenamiento local
  if (normTitle) {
    local.forEach(i => {
      if (i.title && i.title.trim().toLowerCase() === normTitle) {
        addDeletedCatalogId(i.id);
      }
    });
    DEFAULT_REAL_CATALOG.forEach(d => {
      if (d.title && d.title.trim().toLowerCase() === normTitle) {
        addDeletedCatalogId(d.id);
      }
    });
    const filteredLocal = local.filter(i => {
      if (i.id === id) return false;
      if (i.title && i.title.trim().toLowerCase() === normTitle) return false;
      return true;
    });
    localStorage.setItem(LOCAL_CATALOG_KEY, JSON.stringify(filteredLocal));
  } else {
    removeLocalCatalogItem(id);
  }

  try {
    const res = await fetch(`${API_BASE}/admin/catalog/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: normTitle })
    });
    if (res.ok) {
      broadcastCatalogUpdate();
      return await res.json();
    }
  } catch (err) {}

  broadcastCatalogUpdate();
  return { success: true };
}

export async function deleteAllSampleCatalogPhotos() {
  try {
    localStorage.setItem(LOCAL_SAMPLES_PURGED_KEY, 'true');
    SAMPLE_PHOTO_IDS.forEach(id => addDeletedCatalogId(id));

    const local = getLocalCatalog().filter(i => !isSampleItem(i));
    localStorage.setItem(LOCAL_CATALOG_KEY, JSON.stringify(local));

    const res = await fetch(`${API_BASE}/admin/catalog/delete-samples`, {
      method: 'POST'
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Fallback local al purgar muestras:', err);
  }
  return { success: true };
}

export async function changeAdminPin(currentPin, newPin) {
  try {
    const res = await fetch(`${API_BASE}/admin/pin/change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin })
    });
    if (res.ok) {
      localStorage.setItem(LOCAL_PIN_KEY, String(newPin).trim());
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al cambiar PIN');
  } catch (err) {
    // Si falla el servidor, verificar localmente
    const rawLocal = localStorage.getItem(LOCAL_PIN_KEY);
    const localPin = (rawLocal && rawLocal !== '1234') ? rawLocal : DEFAULT_SETTINGS.adminPin;
    if (currentPin === localPin) {
      localStorage.setItem(LOCAL_PIN_KEY, String(newPin).trim());
      return { success: true, message: '¡PIN actualizado exitosamente!' };
    }
    throw err;
  }
}

export async function recoverAdminPin(phone, newPin = null) {
  try {
    const res = await fetch(`${API_BASE}/admin/pin/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, newPin })
    });
    if (res.ok) {
      if (newPin) {
        localStorage.setItem(LOCAL_PIN_KEY, String(newPin).trim());
      }
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Número no reconocido.');
  } catch (err) {
    // Verificación offline por número
    const clean = (phone || '').replace(/\D/g, '');
    const p1 = (DEFAULT_SETTINGS.photographerWhatsApp).replace(/\D/g, '');
    const p2 = (DEFAULT_SETTINGS.photographerWhatsApp2).replace(/\D/g, '');
    if ((clean.length >= 7 && p1.endsWith(clean)) || (clean.length >= 7 && p2.endsWith(clean))) {
      if (newPin) {
        localStorage.setItem(LOCAL_PIN_KEY, String(newPin).trim());
      }
      const rawLocal = localStorage.getItem(LOCAL_PIN_KEY);
      const activePin = (rawLocal && rawLocal !== '1234') ? rawLocal : DEFAULT_SETTINGS.adminPin;
      return { success: true, verified: true, currentPin: activePin };
    }
    throw err;
  }
}
