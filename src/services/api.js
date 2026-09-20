const API_BASE = '/api';
const LOCAL_SESSIONS_KEY = 'sebastian_g_sessions_v1';
const LOCAL_BOOKINGS_KEY = 'sebastian_g_bookings_v1';

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

export async function getSettings() {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Error al obtener configuración');
    const data = await res.json();
    return { ...DEFAULT_SETTINGS, ...data };
  } catch (err) {
    console.warn('Usando configuración por defecto:', err);
    return DEFAULT_SETTINGS;
  }
}

export async function getCatalog() {
  try {
    const res = await fetch(`${API_BASE}/catalog`);
    if (!res.ok) throw new Error('Error al obtener catálogo');
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function getPackages() {
  try {
    const res = await fetch(`${API_BASE}/packages`);
    if (!res.ok) throw new Error('Error al obtener paquetes');
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
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

  if (pin === DEFAULT_SETTINGS.adminPin) {
    return { success: true, token: 'admin-authorized-token' };
  }
  throw new Error('PIN incorrecto. El PIN por defecto es 1234.');
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
