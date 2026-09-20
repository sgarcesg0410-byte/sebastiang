import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper para leer base de datos
function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error leyendo base de datos:', err);
    return { settings: {}, packages: [], catalog: [], bookings: [], sessions: [] };
  }
}

// Helper para guardar base de datos
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error guardando base de datos:', err);
    return false;
  }
}

// --- RUTAS PÚBLICAS ---

// Obtener configuración pública
app.get('/api/settings', (req, res) => {
  const db = readDB();
  const { adminPin, ...publicSettings } = db.settings || {};
  res.json(publicSettings);
});

// Obtener catálogo público
app.get('/api/catalog', (req, res) => {
  const db = readDB();
  res.json(db.catalog || []);
});

// Obtener paquetes de fotos
app.get('/api/packages', (req, res) => {
  const db = readDB();
  res.json(db.packages || []);
});

// Registrar nueva reserva (sin necesidad de registrarse)
app.post('/api/bookings', (req, res) => {
  const {
    clientName,
    clientWhatsApp,
    packageId,
    locationType,
    specificLocation,
    dateTime,
    description
  } = req.body;

  if (!clientName || !clientWhatsApp || !packageId) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para la reserva.' });
  }

  const db = readDB();
  const pkg = db.packages.find(p => p.id === packageId);
  if (!pkg) {
    return res.status(404).json({ error: 'El paquete seleccionado no existe.' });
  }

  // Lógica invisible de San Antero:
  // Si es fuera de San Antero, se le añade automáticamente el recargo sin mostrárselo desglosado
  let finalPrice = pkg.price;
  const surcharge = db.settings.outOfSanAnteroSurcharge || 10;
  if (locationType === 'outside') {
    finalPrice += surcharge;
  }

  const newBooking = {
    id: `book-${Date.now()}`,
    clientName: clientName.trim(),
    clientWhatsApp: clientWhatsApp.trim(),
    packageId: pkg.id,
    packageName: pkg.name,
    basePrice: pkg.price,
    totalPrice: finalPrice,
    locationType: locationType === 'outside' ? 'outside_san_antero' : 'san_antero',
    specificLocation: (specificLocation || '').trim(),
    dateTime,
    description: (description || '').trim(),
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  db.bookings.unshift(newBooking);
  writeDB(db);

  // Generar link de WhatsApp directo hacia el fotógrafo con el resumen
  const photogWhatsApp1 = (db.settings.photographerWhatsApp || '+573244725167').replace(/\D/g, '');
  const photogWhatsApp2 = (db.settings.photographerWhatsApp2 || '+573023696513').replace(/\D/g, '');
  const msgText = encodeURIComponent(
    `📸 *¡Hola Sebastian G! Acabo de hacer una reserva en tu sitio web:*\n\n` +
    `👤 *Nombre:* ${newBooking.clientName}\n` +
    `📱 *WhatsApp:* ${newBooking.clientWhatsApp}\n` +
    `📦 *Paquete:* ${newBooking.packageName} ($${newBooking.totalPrice.toLocaleString('es-CO')} COP)\n` +
    `📍 *Lugar:* ${newBooking.locationType === 'outside_san_antero' ? 'Fuera de San Antero (' + newBooking.specificLocation + ')' : 'En San Antero (' + newBooking.specificLocation + ')'}\n` +
    `🗓️ *Fecha y Hora:* ${newBooking.dateTime}\n` +
    `📝 *Detalles:* ${newBooking.description || 'Sin notas adicionales'}\n\n` +
    `_Quedo atento a tu confirmación para agendarla definitivamente._`
  );

  const directWhatsAppUrl = `https://wa.me/${photogWhatsApp1}?text=${msgText}`;
  const secondaryWhatsAppUrl = `https://wa.me/${photogWhatsApp2}?text=${msgText}`;

  res.status(201).json({
    success: true,
    booking: newBooking,
    directWhatsAppUrl,
    secondaryWhatsAppUrl
  });
});

// Obtener galería privada para selección de cliente por Token
app.get('/api/gallery/:token', (req, res) => {
  const { token } = req.params;
  const db = readDB();
  const session = db.sessions.find(s => s.token === token);

  if (!session) {
    return res.status(404).json({ error: 'La sesión o galería solicitada no existe.' });
  }

  const now = Date.now();
  const expiresTime = new Date(session.expiresAt).getTime();
  const isExpired = now > expiresTime;
  const isSubmitted = session.status === 'submitted';
  const timeRemainingMs = Math.max(0, expiresTime - now);

  res.json({
    id: session.id,
    token: session.token,
    clientName: session.clientName,
    clientWhatsApp: session.clientWhatsApp,
    packageTitle: session.packageTitle,
    maxPhotosAllowed: session.maxPhotosAllowed,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    isExpired,
    isSubmitted,
    timeRemainingMs,
    photos: session.photos,
    watermarkSettings: {
      watermarkText: db.settings.watermarkText,
      watermarkSubtext: db.settings.watermarkSubtext,
      watermarkLogoUrl: db.settings.watermarkLogoUrl
    }
  });
});

// Confirmar y Enviar selección de fotos (SOLO UNA VEZ Y ANTES DE LOS 3 DÍAS)
app.post('/api/gallery/:token/submit', (req, res) => {
  const { token } = req.params;
  const { selections } = req.body; // Array de { id, selected, clientComment }

  const db = readDB();
  const session = db.sessions.find(s => s.token === token);

  if (!session) {
    return res.status(404).json({ error: 'Sesión no encontrada.' });
  }

  // 1. Validar que no haya expirado (3 días)
  const now = Date.now();
  const expiresTime = new Date(session.expiresAt).getTime();
  if (now > expiresTime) {
    return res.status(403).json({
      error: 'El tiempo límite de 3 días para seleccionar tus fotos ha vencido. Contacta a tu fotógrafo.'
    });
  }

  // 2. Validar que no haya sido enviada antes (bloqueo único)
  if (session.status === 'submitted') {
    return res.status(403).json({
      error: 'Esta selección ya fue enviada previamente y se encuentra bloqueada. Ya no es posible modificarla.'
    });
  }

  if (!Array.isArray(selections)) {
    return res.status(400).json({ error: 'Formato de selecciones no válido.' });
  }

  // Actualizar fotos
  const selectionMap = new Map();
  selections.forEach(item => {
    selectionMap.set(item.id, {
      selected: Boolean(item.selected),
      clientComment: (item.clientComment || '').trim()
    });
  });

  const selectedCount = selections.filter(s => s.selected).length;
  if (selectedCount === 0) {
    return res.status(400).json({ error: 'Debes seleccionar al menos una foto antes de enviar.' });
  }

  session.photos = session.photos.map(photo => {
    const update = selectionMap.get(photo.id);
    if (update) {
      return {
        ...photo,
        selected: update.selected,
        clientComment: update.clientComment
      };
    }
    return photo;
  });

  // Bloquear sesión definitivamente
  session.status = 'submitted';
  session.submittedAt = new Date().toISOString();

  writeDB(db);

  // Crear texto resumen para el fotógrafo
  const selectedList = session.photos.filter(p => p.selected);
  let summaryText = `🎉 *¡${session.clientName} ha enviado su selección de fotos!*\n\n`;
  summaryText += `📦 *Sesión:* ${session.packageTitle}\n`;
  summaryText += `🔢 *Fotos Elegidas:* ${selectedList.length} de ${session.maxPhotosAllowed}\n\n`;
  summaryText += `*Detalle de fotos seleccionadas:*\n`;

  selectedList.forEach((photo, idx) => {
    summaryText += `\n${idx + 1}. *${photo.title}*`;
    if (photo.clientComment) {
      summaryText += `\n   💬 _Comentario:_ "${photo.clientComment}"`;
    }
  });

  const photogWhatsApp1 = (db.settings.photographerWhatsApp || '+573244725167').replace(/\D/g, '');
  const photogWhatsApp2 = (db.settings.photographerWhatsApp2 || '+573023696513').replace(/\D/g, '');
  const directWhatsAppUrl = `https://wa.me/${photogWhatsApp1}?text=${encodeURIComponent(summaryText)}`;
  const secondaryWhatsAppUrl = `https://wa.me/${photogWhatsApp2}?text=${encodeURIComponent(summaryText)}`;

  res.json({
    success: true,
    message: '¡Selección guardada y bloqueada con éxito!',
    selectedCount: selectedList.length,
    directWhatsAppUrl,
    secondaryWhatsAppUrl,
    summaryText
  });
});

// --- RUTAS DE ADMINISTRACIÓN (FOTÓGRAFO) ---

// Validar PIN de administrador
app.post('/api/admin/auth', (req, res) => {
  const { pin } = req.body;
  const db = readDB();
  if (pin === db.settings.adminPin) {
    res.json({ success: true, token: 'admin-authorized-token' });
  } else {
    res.status(401).json({ error: 'PIN incorrecto. Acceso denegado.' });
  }
});

// Obtener todas las reservas para el fotógrafo
app.get('/api/admin/bookings', (req, res) => {
  const db = readDB();
  res.json(db.bookings || []);
});

// Cambiar estado de una reserva
app.patch('/api/admin/bookings/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const db = readDB();
  const booking = db.bookings.find(b => b.id === id);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });

  booking.status = status;
  writeDB(db);
  res.json({ success: true, booking });
});

// Obtener todas las sesiones de clientes creadas
app.get('/api/admin/sessions', (req, res) => {
  const db = readDB();
  const now = Date.now();
  const enriched = (db.sessions || []).map(s => {
    const expiresTime = new Date(s.expiresAt).getTime();
    const isExpired = now > expiresTime;
    return {
      ...s,
      isExpired,
      selectedCount: s.photos ? s.photos.filter(p => p.selected).length : 0,
      totalPhotos: s.photos ? s.photos.length : 0
    };
  });
  res.json(enriched);
});

// Crear una nueva sesión de fotos para un cliente (con 3 días de vigencia)
app.post('/api/admin/sessions', (req, res) => {
  const {
    clientName,
    clientWhatsApp,
    packageTitle,
    maxPhotosAllowed,
    photos // Array de { title, url }
  } = req.body;

  if (!clientName || !clientWhatsApp || !photos || photos.length === 0) {
    return res.status(400).json({ error: 'Faltan datos del cliente o fotos para la sesión.' });
  }

  const db = readDB();
  const now = new Date();
  // EXACTAMENTE 3 DÍAS DE VIGENCIA
  const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Token único legible y seguro
  const cleanName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15);
  const token = `${cleanName}-${Math.random().toString(36).substring(2, 8)}`;

  const newSession = {
    id: `sess-${Date.now()}`,
    token,
    clientName: clientName.trim(),
    clientWhatsApp: clientWhatsApp.trim(),
    packageTitle: packageTitle || 'Sesión Fotográfica',
    maxPhotosAllowed: Number(maxPhotosAllowed) || photos.length,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'pending',
    submittedAt: null,
    photos: photos.map((p, idx) => ({
      id: `photo-${Date.now()}-${idx + 1}`,
      title: p.title || `Foto #${idx + 1}`,
      url: p.url,
      selected: false,
      clientComment: ''
    }))
  };

  db.sessions.unshift(newSession);
  writeDB(db);

  res.status(201).json({
    success: true,
    session: newSession,
    link: `/galeria/${token}`
  });
});

// Reabrir o extender sesión vencida (si el fotógrafo le da permiso al cliente)
app.post('/api/admin/sessions/:id/reopen', (req, res) => {
  const { id } = req.params;
  const { additionalDays = 3, allowReSelection = true } = req.body;

  const db = readDB();
  const session = db.sessions.find(s => s.id === id);
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });

  const newExpires = new Date(Date.now() + additionalDays * 24 * 60 * 60 * 1000);
  session.expiresAt = newExpires.toISOString();

  if (allowReSelection) {
    session.status = 'pending';
    session.submittedAt = null;
  }

  writeDB(db);
  res.json({ success: true, session });
});

// Actualizar configuración general y paquetes
app.post('/api/admin/settings', (req, res) => {
  const { settings, packages } = req.body;
  const db = readDB();

  if (settings) {
    db.settings = { ...db.settings, ...settings };
  }
  if (packages && Array.isArray(packages)) {
    db.packages = packages;
  }

  writeDB(db);
  res.json({ success: true, settings: db.settings, packages: db.packages });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de Foto Reservas corriendo en http://localhost:${PORT}`);
});
