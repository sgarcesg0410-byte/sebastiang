const API_BASE = '/api';

export async function getSettings() {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Error al obtener configuración');
    return await res.json();
  } catch (err) {
    console.error(err);
    return {
      photographerName: "Estudio San Antero",
      photographerWhatsApp: "+573001234567",
      outOfSanAnteroSurcharge: 10,
      currencySymbol: "$",
      watermarkText: "ESTUDIO SAN ANTERO",
      watermarkSubtext: "MUESTRA DE REVISIÓN • PROHIBIDA SU DESCARGA"
    };
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
  const res = await fetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al procesar la reserva');
  }
  return await res.json();
}

export async function getGalleryByToken(token) {
  const res = await fetch(`${API_BASE}/gallery/${token}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Galería no encontrada');
  }
  return await res.json();
}

export async function submitGallerySelection(token, selections) {
  const res = await fetch(`${API_BASE}/gallery/${token}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selections })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al enviar la selección');
  }
  return await res.json();
}

export async function verifyAdminPin(pin) {
  const res = await fetch(`${API_BASE}/admin/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'PIN incorrecto');
  }
  return await res.json();
}

export async function getAdminBookings() {
  const res = await fetch(`${API_BASE}/admin/bookings`);
  if (!res.ok) throw new Error('Error al obtener reservas');
  return await res.json();
}

export async function updateBookingStatus(id, status) {
  const res = await fetch(`${API_BASE}/admin/bookings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  return await res.json();
}

export async function getAdminSessions() {
  const res = await fetch(`${API_BASE}/admin/sessions`);
  if (!res.ok) throw new Error('Error al obtener sesiones');
  return await res.json();
}

export async function createAdminSession(data) {
  const res = await fetch(`${API_BASE}/admin/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al crear la sesión');
  }
  return await res.json();
}

export async function reopenAdminSession(id, additionalDays = 3) {
  const res = await fetch(`${API_BASE}/admin/sessions/${id}/reopen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ additionalDays })
  });
  return await res.json();
}

export async function updateAdminSettings(settings, packages) {
  const res = await fetch(`${API_BASE}/admin/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, packages })
  });
  return await res.json();
}
