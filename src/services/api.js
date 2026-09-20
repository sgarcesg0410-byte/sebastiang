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

const SAMPLE_PHOTO_IDS = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-8'];

export const DEFAULT_REAL_CATALOG = [
  {
    id: "cat-verano-salsero",
    title: "Verano salsero",
    category: "Retratos",
    url: "/catalog/verano-salsero.jpg",
    location: "Playas de Coveñas"
  },
  {
    id: "cat-atardecer-covenas",
    title: "Atardecer",
    category: "Retratos",
    url: "/catalog/atardecer-covenas.jpg",
    location: "Playas el Edén - Coveñas"
  }
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
  watermarkLogoUrl: "/logo-white.png",
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
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalSession(session) {
  try {
    const sessions = getLocalSessions().filter(s => s.id !== session.id && s.token !== session.token);
    sessions.unshift(session);
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn('No se pudo guardar en localStorage:', e);
  }
}

function getLocalBookings() {
  try {
    const raw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalBooking(booking) {
  try {
    const bookings = getLocalBookings().filter(b => b.id !== booking.id);
    bookings.unshift(booking);
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(bookings));
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

export async function getCatalog() {
  let supabaseCatalog = [];
  try {
    const { data, error } = await supabase
      .from('catalog')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      supabaseCatalog = data;
    }
  } catch (err) {
    console.warn('Error obteniendo catálogo de Supabase:', err);
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

  // Fuentes en orden de prioridad:
  // 1. Fotos en la nube Supabase (sincronizadas entre todos los dispositivos)
  // 2. Fotos locales en este dispositivo
  // 3. Fotos del servidor
  // 4. Catálogo base predeterminado
  const allCandidates = [...supabaseCatalog, ...localItems, ...serverCatalog, ...DEFAULT_REAL_CATALOG];

  const result = [];
  const seenIds = new Set();
  const seenTitles = new Set();

  for (const item of allCandidates) {
    if (!item || !item.id) continue;
    // Si el item fue eliminado por el usuario, descartarlo
    if (deletedIds.has(item.id)) continue;
    // Si las muestras demo fueron purgadas y es foto demo de Unsplash, descartarlo
    if (samplesPurged && isSampleItem(item)) continue;

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

  return result;
}

export async function getPackages() {
  const localPkgs = getLocalPackages();
  try {
    const res = await fetch(`${API_BASE}/packages`);
    if (res.ok) {
      const serverPkgs = await res.json();
      if (localPkgs && localPkgs.length > 0) {
        return localPkgs;
      }
      return serverPkgs;
    }
  } catch (err) {
    console.error(err);
  }
  return localPkgs || [];
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
    `📍 *Lugar:* ${newBooking.specificLocation || 'San Antero'}\n` +
    `🗓️ *Fecha:* ${newBooking.dateTime}\n` +
    `📝 *Detalles:* ${newBooking.description || 'Sin notas adicionales'}`
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
      saveLocalSession(data);
      return data;
    }
  } catch (err) {
    console.warn('Error conectando con servidor para galería, consultando local:', err);
  }

  // Buscar en fallback local
  const local = getLocalSessions().find(s => s.token === token);
  if (local) {
    const now = Date.now();
    const expiresTime = new Date(local.expiresAt).getTime();
    return {
      ...local,
      isExpired: now > expiresTime,
      isSubmitted: local.status === 'submitted',
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
      localStorage.setItem(LOCAL_PIN_KEY, cleanPin);
      return data;
    }
  } catch (err) {
    console.warn('Verificando PIN en modo offline:', err);
  }

  if (localSavedPin && cleanPin === localSavedPin && cleanPin !== '1234') {
    return { success: true, token: 'admin-authorized-token' };
  }

  if (cleanPin === DEFAULT_SETTINGS.adminPin) {
    localStorage.setItem(LOCAL_PIN_KEY, cleanPin);
    return { success: true, token: 'admin-authorized-token' };
  }
  throw new Error('PIN incorrecto.');
}

export async function getAdminBookings() {
  try {
    const res = await fetch(`${API_BASE}/admin/bookings`);
    if (res.ok) {
      const data = await res.json();
      const local = getLocalBookings();
      const map = new Map();
      [...data, ...local].forEach(b => map.set(b.id, b));
      return Array.from(map.values());
    }
  } catch (err) {
    console.warn(err);
  }
  return getLocalBookings();
}

export async function updateBookingStatus(id, status) {
  try {
    const res = await fetch(`${API_BASE}/admin/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn(err);
  }

  const local = getLocalBookings().map(b => b.id === id ? { ...b, status } : b);
  localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(local));
  return { success: true };
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
    if (s && s.token) {
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

export async function addCatalogPhoto(photoData) {
  const newItem = {
    id: `cat-${Date.now()}`,
    title: (photoData.title || '').trim(),
    category: (photoData.category || 'Retratos').trim(),
    location: (photoData.location || 'San Antero').trim(),
    url: photoData.url
  };

  // 1. Guardar primero en Supabase en la nube
  try {
    const { data, error } = await supabase.from('catalog').insert(newItem).select();
    if (!error && data && data.length > 0) {
      saveLocalCatalogItem(data[0]);
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
      body: JSON.stringify(photoData)
    });
    if (res.ok) {
      const data = await res.json();
      saveLocalCatalogItem(data.item);
      return data;
    }
  } catch (err) {
    console.warn('Fallback local para catálogo:', err);
  }

  // 3. Fallback a almacenamiento local
  saveLocalCatalogItem(newItem);
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
      return await res.json();
    }
  } catch (err) {}

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
