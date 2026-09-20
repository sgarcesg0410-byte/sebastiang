const API_BASE = '/api';
const LOCAL_SESSIONS_KEY = 'sebastian_g_sessions_v1';
const LOCAL_BOOKINGS_KEY = 'sebastian_g_bookings_v1';
const LOCAL_CATALOG_KEY = 'sebastian_g_catalog_v1';
const LOCAL_PIN_KEY = 'sebastian_g_admin_pin';
const LOCAL_PACKAGES_KEY = 'sebastian_g_packages_v1';
const LOCAL_SETTINGS_KEY = 'sebastian_g_settings_v1';

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
  adminPin: "1234",
  printedPhotoPrice: 7000
};

// Helpers de almacenamiento local de respaldo
function getLocalCatalog() {
  try {
    const raw = localStorage.getItem(LOCAL_CATALOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalCatalogItem(item) {
  try {
    const items = getLocalCatalog().filter(i => i.id !== item.id);
    items.unshift(item);
    localStorage.setItem(LOCAL_CATALOG_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('No se pudo guardar item de catálogo:', e);
  }
}

function removeLocalCatalogItem(id) {
  try {
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
  let serverCatalog = [];
  try {
    const res = await fetch(`${API_BASE}/catalog`);
    if (res.ok) serverCatalog = await res.json();
  } catch (err) {
    console.warn('Error obteniendo catálogo de servidor:', err);
  }

  const localItems = getLocalCatalog();
  const map = new Map();
  [...localItems, ...serverCatalog].forEach(item => {
    if (item && item.id) map.set(item.id, item);
  });
  return Array.from(map.values());
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
  const localSavedPin = localStorage.getItem(LOCAL_PIN_KEY);
  try {
    const res = await fetch(`${API_BASE}/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Verificando PIN en modo offline:', err);
  }

  if (localSavedPin && pin === localSavedPin) {
    return { success: true, token: 'admin-authorized-token' };
  }

  if (pin === DEFAULT_SETTINGS.adminPin) {
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

  const newItem = {
    id: `cat-${Date.now()}`,
    ...photoData
  };
  saveLocalCatalogItem(newItem);
  return { success: true, item: newItem };
}

export async function deleteCatalogPhoto(id) {
  try {
    const res = await fetch(`${API_BASE}/admin/catalog/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      removeLocalCatalogItem(id);
      return await res.json();
    }
  } catch (err) {
    console.warn('Fallback local para eliminar de catálogo:', err);
  }
  removeLocalCatalogItem(id);
  return { success: true, id };
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
    const localPin = localStorage.getItem(LOCAL_PIN_KEY) || DEFAULT_SETTINGS.adminPin;
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
      return { success: true, verified: true, currentPin: localStorage.getItem(LOCAL_PIN_KEY) || DEFAULT_SETTINGS.adminPin };
    }
    throw err;
  }
}
