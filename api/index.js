import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper para leer base de datos (con fallback seguro en servidor Vercel)
function getDB() {
  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }
  } catch (err) {
    console.error('Error leyendo base de datos:', err);
  }

  return {
    settings: {
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
    },
    packages: [
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
    ],
    catalog: [
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
    ],
    bookings: [],
    sessions: [
      {
        id: "sess-demo",
        token: "demo-cliente-2026",
        clientName: "Camila Rodríguez",
        clientWhatsApp: "+573105551234",
        packageTitle: "8 Fotos Digitales (+ 2 Fotos Gratis)",
        maxPhotosAllowed: 10,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        status: "pending",
        submittedAt: null,
        photos: [
          { id: "photo-1", title: "Foto 001 - Retrato Primer Plano", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
          { id: "photo-2", title: "Foto 002 - Mirada al Atardecer", url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
          { id: "photo-3", title: "Foto 003 - Sonrisa en la Orilla", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
          { id: "photo-4", title: "Foto 004 - Movimiento y Brisa", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
          { id: "photo-5", title: "Foto 005 - Plano Entero en la Playa", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
          { id: "photo-6", title: "Foto 006 - Silueta en Contraluz", url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" }
        ]
      }
    ]
  };
}

// En memoria para serverless
let runtimeDB = getDB();

app.get('/api/settings', (req, res) => {
  const { adminPin, ...publicSettings } = runtimeDB.settings || {};
  res.json(publicSettings);
});

app.get('/api/catalog', (req, res) => {
  res.json(runtimeDB.catalog || []);
});

app.get('/api/packages', (req, res) => {
  res.json(runtimeDB.packages || []);
});

app.post('/api/packages', (req, res) => {
  const { packages } = req.body;
  if (Array.isArray(packages)) {
    runtimeDB.packages = packages;
    try {
      const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
      if (fs.existsSync(dbPath)) {
        const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        current.packages = packages;
        fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
      }
    } catch (e) {}
  }
  res.json({ success: true, packages: runtimeDB.packages });
});

app.post('/api/settings', (req, res) => {
  const newSettings = req.body;
  if (newSettings && typeof newSettings === 'object') {
    runtimeDB.settings = { ...runtimeDB.settings, ...newSettings };
    try {
      const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
      if (fs.existsSync(dbPath)) {
        const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        current.settings = runtimeDB.settings;
        fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
      }
    } catch (e) {}
  }
  res.json({ success: true, settings: runtimeDB.settings });
});

app.post('/api/bookings', (req, res) => {
  const { clientName, clientWhatsApp, packageId, locationType, specificLocation, dateTime, description } = req.body;
  const pkg = runtimeDB.packages.find(p => p.id === packageId) || runtimeDB.packages[0];

  let finalPrice = pkg.price;
  const surcharge = runtimeDB.settings.outOfSanAnteroSurcharge || 10000;
  if (locationType === 'outside') finalPrice += surcharge;

  const newBooking = {
    id: `book-${Date.now()}`,
    clientName: clientName.trim(),
    clientWhatsApp: clientWhatsApp.trim(),
    packageId: pkg.id,
    packageName: pkg.name,
    totalPrice: finalPrice,
    locationType: locationType === 'outside' ? 'outside_san_antero' : 'san_antero',
    specificLocation: (specificLocation || '').trim(),
    dateTime,
    description: (description || '').trim(),
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  runtimeDB.bookings.unshift(newBooking);

  const photogWhatsApp1 = (runtimeDB.settings.photographerWhatsApp || '+573244725167').replace(/\D/g, '');
  const photogWhatsApp2 = (runtimeDB.settings.photographerWhatsApp2 || '+573023696513').replace(/\D/g, '');
  const msgText = encodeURIComponent(
    `📸 *¡Hola Sebastian G! Acabo de hacer una reserva en tu sitio web:*\n\n` +
    `👤 *Nombre:* ${newBooking.clientName}\n` +
    `📱 *WhatsApp:* ${newBooking.clientWhatsApp}\n` +
    `📦 *Paquete:* ${newBooking.packageName} ($${newBooking.totalPrice.toLocaleString('es-CO')} COP)\n` +
    `📍 *Lugar:* ${newBooking.locationType === 'outside_san_antero' ? 'Fuera de San Antero (' + newBooking.specificLocation + ')' : 'En San Antero (' + newBooking.specificLocation + ')'}\n` +
    `🗓️ *Fecha y Hora:* ${newBooking.dateTime}\n` +
    `📝 *Detalles:* ${newBooking.description || 'Sin notas adicionales'}`
  );

  res.status(201).json({
    success: true,
    booking: newBooking,
    directWhatsAppUrl: `https://wa.me/${photogWhatsApp1}?text=${msgText}`,
    secondaryWhatsAppUrl: `https://wa.me/${photogWhatsApp2}?text=${msgText}`
  });
});

app.get('/api/gallery/:token', (req, res) => {
  const { token } = req.params;
  const session = runtimeDB.sessions.find(s => s.token === token);
  if (!session) return res.status(404).json({ error: 'Galería no encontrada.' });

  const now = Date.now();
  const expiresTime = new Date(session.expiresAt).getTime();
  const isExpired = now > expiresTime;
  const isSubmitted = session.status === 'submitted';

  res.json({
    ...session,
    isExpired,
    isSubmitted,
    watermarkSettings: {
      watermarkText: runtimeDB.settings.watermarkText,
      watermarkSubtext: runtimeDB.settings.watermarkSubtext,
      watermarkLogoUrl: runtimeDB.settings.watermarkLogoUrl
    }
  });
});

app.post('/api/gallery/:token/submit', (req, res) => {
  const { token } = req.params;
  const { selections } = req.body;
  const session = runtimeDB.sessions.find(s => s.token === token);
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });

  if (session.status === 'submitted') {
    return res.status(403).json({ error: 'Esta selección ya fue enviada previamente y se encuentra bloqueada.' });
  }

  // Actualizar fotos elegidas y comentarios
  const selMap = new Map();
  (selections || []).forEach(item => {
    selMap.set(item.id, {
      selected: Boolean(item.selected),
      comment: (item.clientComment || '').trim()
    });
  });

  session.photos = session.photos.map(p => {
    const update = selMap.get(p.id);
    if (update) {
      return { ...p, selected: update.selected, clientComment: update.comment };
    }
    return p;
  });

  session.status = 'submitted';
  session.submittedAt = new Date().toISOString();

  // Armar lista detallada de fotos seleccionadas con sus notas
  const selectedPhotos = session.photos.filter(p => p.selected);
  let summary = `📸 *¡Hola Sebastian G! Ya elegí las fotos de mi sesión:*\n\n`;
  summary += `👤 *Cliente:* ${session.clientName}\n`;
  summary += `📦 *Sesión:* ${session.packageTitle}\n`;
  summary += `🔢 *Total Elegidas:* ${selectedPhotos.length} fotos\n\n`;
  summary += `*Lista de fotos seleccionadas:*\n`;

  selectedPhotos.forEach((p, idx) => {
    summary += `\n${idx + 1}. *${p.title}*`;
    if (p.clientComment) {
      summary += `\n   💬 _Nota:_ "${p.clientComment}"`;
    }
  });

  summary += `\n\n_Quedo atento a la entrega final en alta resolución. ¡Muchas gracias!_`;

  const photogWhatsApp1 = (runtimeDB.settings.photographerWhatsApp || '+573244725167').replace(/\D/g, '');
  const photogWhatsApp2 = (runtimeDB.settings.photographerWhatsApp2 || '+573023696513').replace(/\D/g, '');
  const directWhatsAppUrl = `https://wa.me/${photogWhatsApp1}?text=${encodeURIComponent(summary)}`;
  const secondaryWhatsAppUrl = `https://wa.me/${photogWhatsApp2}?text=${encodeURIComponent(summary)}`;

  res.json({
    success: true,
    message: '¡Selección guardada y bloqueada con éxito!',
    selectedCount: selectedPhotos.length,
    directWhatsAppUrl,
    secondaryWhatsAppUrl,
    summary
  });
});

app.post('/api/admin/auth', (req, res) => {
  const { pin } = req.body;
  if (pin === (runtimeDB.settings.adminPin || '0493')) {
    res.json({ success: true, token: 'admin-authorized-token' });
  } else {
    res.status(401).json({ error: 'PIN incorrecto. Acceso denegado.' });
  }
});

app.get('/api/admin/bookings', (req, res) => {
  res.json(runtimeDB.bookings || []);
});

app.patch('/api/admin/bookings/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const booking = (runtimeDB.bookings || []).find(b => b.id === id);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });

  booking.status = status;
  res.json({ success: true, booking });
});

app.get('/api/admin/sessions', (req, res) => {
  const now = Date.now();
  const enriched = (runtimeDB.sessions || []).map(s => {
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

app.post('/api/admin/sessions', (req, res) => {
  const {
    clientName,
    clientWhatsApp,
    packageTitle,
    maxPhotosAllowed,
    photos
  } = req.body;

  if (!clientName || !clientWhatsApp || !photos || photos.length === 0) {
    return res.status(400).json({ error: 'Faltan datos del cliente o fotos para la sesión.' });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
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

  runtimeDB.sessions.unshift(newSession);

  res.status(201).json({
    success: true,
    session: newSession,
    link: `/galeria/${token}`
  });
});

app.post('/api/admin/sessions/:id/reopen', (req, res) => {
  const { id } = req.params;
  const { additionalDays = 3, allowReSelection = true } = req.body;

  const session = (runtimeDB.sessions || []).find(s => s.id === id);
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });

  const newExpires = new Date(Date.now() + additionalDays * 24 * 60 * 60 * 1000);
  session.expiresAt = newExpires.toISOString();

  if (allowReSelection) {
    session.status = 'pending';
    session.submittedAt = null;
  }

  res.json({ success: true, session });
});

app.post('/api/admin/settings', (req, res) => {
  const { settings, packages } = req.body;
  if (settings) {
    runtimeDB.settings = { ...runtimeDB.settings, ...settings };
  }
  if (packages && Array.isArray(packages)) {
    runtimeDB.packages = packages;
  }
  res.json({ success: true, settings: runtimeDB.settings, packages: runtimeDB.packages });
});

// --- GESTIÓN DE CATÁLOGO (FOTOS PÚBLICAS) ---
app.post('/api/admin/catalog', (req, res) => {
  const { title, category, url, location } = req.body;
  if (!title || !url) {
    return res.status(400).json({ error: 'Faltan título o imagen de la foto.' });
  }
  const newItem = {
    id: `cat-${Date.now()}`,
    title: title.trim(),
    category: (category || 'Retratos').trim(),
    url: url.trim(),
    location: (location || 'San Antero').trim()
  };
  if (!runtimeDB.catalog) runtimeDB.catalog = [];
  runtimeDB.catalog.unshift(newItem);

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.catalog = runtimeDB.catalog;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

  res.status(201).json({ success: true, item: newItem });
});

app.delete('/api/admin/catalog/:id', (req, res) => {
  const { id } = req.params;
  const bodyTitle = req.body && req.body.title ? req.body.title.trim().toLowerCase() : null;
  const target = (runtimeDB.catalog || []).find(c => c.id === id);
  const targetTitle = bodyTitle || (target?.title ? target.title.trim().toLowerCase() : null);

  runtimeDB.catalog = (runtimeDB.catalog || []).filter(c => {
    if (c.id === id) return false;
    if (targetTitle && c.title && c.title.trim().toLowerCase() === targetTitle) return false;
    return true;
  });

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.catalog = runtimeDB.catalog;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

  res.json({ success: true, id });
});

app.post('/api/admin/catalog/delete-samples', (req, res) => {
  runtimeDB.catalog = (runtimeDB.catalog || []).filter(c => {
    const isSample = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-8'].includes(c.id) ||
      (c.url && c.url.includes('unsplash.com'));
    return !isSample;
  });

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.catalog = runtimeDB.catalog;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

  res.json({ success: true, catalog: runtimeDB.catalog });
});

// --- SEGURIDAD Y CAMBIO / RECUPERACIÓN DE PIN ---
app.post('/api/admin/pin/change', (req, res) => {
  const { currentPin, newPin } = req.body;
  if (currentPin !== (runtimeDB.settings.adminPin || '0493')) {
    return res.status(401).json({ error: 'El PIN actual no coincide.' });
  }
  if (!newPin || String(newPin).length < 4) {
    return res.status(400).json({ error: 'El nuevo PIN debe tener mínimo 4 caracteres.' });
  }
  runtimeDB.settings.adminPin = String(newPin).trim();
  res.json({ success: true, message: '¡PIN de acceso actualizado correctamente!' });
});

app.post('/api/admin/pin/recover', (req, res) => {
  const { phone, newPin } = req.body;
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const p1 = (runtimeDB.settings.photographerWhatsApp || '+573244725167').replace(/\D/g, '');
  const p2 = (runtimeDB.settings.photographerWhatsApp2 || '+573023696513').replace(/\D/g, '');

  const matchesP1 = cleanPhone.length >= 7 && (p1.endsWith(cleanPhone) || cleanPhone.endsWith(p1.slice(-10)));
  const matchesP2 = cleanPhone.length >= 7 && (p2.endsWith(cleanPhone) || cleanPhone.endsWith(p2.slice(-10)));

  if (!matchesP1 && !matchesP2) {
    return res.status(403).json({ error: 'El número no coincide con las líneas de WhatsApp registradas de Sebastian G.' });
  }

  if (newPin) {
    if (String(newPin).length < 4) {
      return res.status(400).json({ error: 'El nuevo PIN debe tener mínimo 4 caracteres.' });
    }
    runtimeDB.settings.adminPin = String(newPin).trim();
    return res.json({ success: true, message: '¡PIN restablecido con éxito!' });
  }

  res.json({ success: true, verified: true, currentPin: runtimeDB.settings.adminPin });
});

export default app;
