import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendNewBookingEmails, sendBookingConfirmedEmail, sendPhotoDeliveryEmail } from './emailService.js';

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
      watermarkLogoUrl: "/app-icon.png",
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
    ],
    bookings: [
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
    ],
    payments: [],
    sessions: [],
    reviews: [],
    walletBalances: {
      nequi: 0,
      daviplata: 0,
      dale: 0
    }
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

// Reseñas y Calificaciones Públicas de Clientes (Testimonios)
app.get('/api/reviews', (req, res) => {
  res.json(runtimeDB.reviews || []);
});

app.post('/api/gallery/:token/review', (req, res) => {
  const { token } = req.params;
  const { clientName, sessionTitle, rating, comment, recommend } = req.body;
  const newReview = {
    id: `rev-${Date.now()}`,
    token,
    clientName: (clientName || 'Cliente').trim(),
    sessionTitle: sessionTitle || 'Sesión Fotográfica',
    rating: Number(rating) || 5,
    recommend: recommend !== false,
    comment: (comment || '').trim(),
    date: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    verified: true
  };
  if (!runtimeDB.reviews) runtimeDB.reviews = [];
  runtimeDB.reviews.unshift(newReview);

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.reviews = runtimeDB.reviews;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

  res.json({ success: true, review: newReview });
});

// Saldos Base Oficiales de Cuentas (Nequi, DaviPlata, Dale)
app.get('/api/admin/wallets', (req, res) => {
  res.json(runtimeDB.walletBalances || { nequi: 0, daviplata: 0, dale: 0 });
});

app.post('/api/admin/wallets', (req, res) => {
  const balances = req.body;
  if (balances && typeof balances === 'object') {
    runtimeDB.walletBalances = { ...runtimeDB.walletBalances, ...balances };
    try {
      const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
      if (fs.existsSync(dbPath)) {
        const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        current.walletBalances = runtimeDB.walletBalances;
        fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
      }
    } catch (e) {}
  }
  res.json({ success: true, walletBalances: runtimeDB.walletBalances });
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
  const { clientName, clientWhatsApp, clientEmail, packageId, locationType, specificLocation, dateTime, description } = req.body;
  const pkg = runtimeDB.packages.find(p => p.id === packageId) || runtimeDB.packages[0];

  let finalPrice = pkg.price;
  const surcharge = runtimeDB.settings.outOfSanAnteroSurcharge || 10000;
  if (locationType === 'outside') finalPrice += surcharge;

  const newBooking = {
    id: `book-${Date.now()}`,
    clientName: clientName.trim(),
    clientWhatsApp: clientWhatsApp.trim(),
    clientEmail: (clientEmail || '').trim(),
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

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.bookings = runtimeDB.bookings;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

  // Disparo asíncrono de correos automáticos (a Sebastián y al cliente si suministró correo)
  sendNewBookingEmails(newBooking, runtimeDB.settings).catch(err => {
    console.error('Error enviando correos de nueva reserva:', err);
  });

  const photogWhatsApp1 = (runtimeDB.settings.photographerWhatsApp || '+573244725167').replace(/\D/g, '');
  const photogWhatsApp2 = (runtimeDB.settings.photographerWhatsApp2 || '+573023696513').replace(/\D/g, '');
  const msgText = encodeURIComponent(
    `📸 *¡Hola Sebastian G! Acabo de hacer una reserva en tu sitio web:*\n\n` +
    `👤 *Nombre:* ${newBooking.clientName}\n` +
    `📱 *WhatsApp:* ${newBooking.clientWhatsApp}\n` +
    (newBooking.clientEmail ? `✉️ *Correo:* ${newBooking.clientEmail}\n` : '') +
    `📦 *Paquete:* ${newBooking.packageName} ($${newBooking.totalPrice.toLocaleString('es-CO')} COP)\n` +
    `📍 *Lugar:* ${newBooking.locationType === 'outside_san_antero' ? 'Locación Especial / Fuera (' + newBooking.specificLocation + ')' : 'Sesión Local (' + newBooking.specificLocation + ')'}\n` +
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

// Endpoint oficial de envío de correos desde el software
app.post('/api/send-email', async (req, res) => {
  const { type, data } = req.body || {};
  try {
    if (type === 'booking_confirmation') {
      const ok = await sendBookingConfirmedEmail(data.booking, data.customNotes);
      return res.json({ success: ok, message: ok ? 'Correo de confirmación enviado' : 'No se pudo enviar el correo' });
    } else if (type === 'photo_delivery') {
      const ok = await sendPhotoDeliveryEmail(data);
      return res.json({ success: ok, message: ok ? 'Fotos enviadas por correo al cliente' : 'No se pudo enviar el correo' });
    } else if (type === 'test') {
      const ok = await sendNewBookingEmails(data?.booking || {
        clientName: 'Cliente de Prueba',
        clientWhatsApp: '+57 300 000 0000',
        clientEmail: 'reservas@sebastiang.app',
        packageName: '8 Fotos Digitales',
        dateTime: 'Hoy a las 4:00 PM',
        specificLocation: 'Playa San Antero',
        totalPrice: 75000
      }, runtimeDB.settings);
      return res.json({ success: true, message: 'Correo de prueba enviado con éxito' });
    }
    return res.status(400).json({ error: 'Tipo de correo no soportado' });
  } catch (err) {
    console.error('Error en /api/send-email:', err);
    return res.status(500).json({ error: err.message || 'Error interno al enviar correo' });
  }
});

app.get('/api/gallery/:token', (req, res) => {
  const { token } = req.params;
  let session = (runtimeDB.sessions || []).find(s => s.token === token);

  // Soporte para demostración pública sin ensuciar la base de datos de clientes reales
  if (!session && token === 'demo-cliente-2026') {
    session = {
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
      photos: [
        { id: "photo-1", title: "Foto 001 - Retrato Primer Plano", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-2", title: "Foto 002 - Mirada al Atardecer", url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-3", title: "Foto 003 - Sonrisa en la Orilla", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-4", title: "Foto 004 - Movimiento y Brisa", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-5", title: "Foto 005 - Plano Entero en la Playa", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" },
        { id: "photo-6", title: "Foto 006 - Silueta en Contraluz", url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80", selected: false, clientComment: "" }
      ]
    };
  }

  if (!session) return res.status(404).json({ error: 'Galería no encontrada.' });

  const now = Date.now();
  const expiresTime = new Date(session.expiresAt).getTime();
  const isExpired = now > expiresTime;
  const isSubmitted = session.status === 'submitted' || session.status === 'delivered';
  const isDelivered = session.status === 'delivered';

  res.json({
    ...session,
    isExpired,
    isSubmitted,
    isDelivered,
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
  const updates = req.body;
  const booking = (runtimeDB.bookings || []).find(b => b.id === id);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });

  Object.assign(booking, updates);

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.bookings = runtimeDB.bookings;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

  res.json({ success: true, booking });
});

app.delete('/api/admin/bookings/:id', (req, res) => {
  const { id } = req.params;
  runtimeDB.bookings = (runtimeDB.bookings || []).filter(b => b.id !== id);

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.bookings = runtimeDB.bookings;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

  res.json({ success: true });
});

// --- PASARELAS DE PAGO DIRECTO (NEQUI, DAVIPLATA, DALE) ---
app.get('/api/admin/payments', (req, res) => {
  res.json(runtimeDB.payments || []);
});

app.post('/api/payments', (req, res) => {
  const { clientName, clientWhatsApp, sessionToken, packageTitle, amount, method, reference, voucherUrl, extraPhotosCount, printedPhotosCount } = req.body;
  const newPayment = {
    id: `pay-${Date.now()}`,
    clientName: (clientName || 'Cliente').trim(),
    clientWhatsApp: (clientWhatsApp || '').trim(),
    sessionToken: sessionToken || '',
    packageTitle: packageTitle || 'Sesión Fotográfica',
    amount: Number(amount) || 0,
    method: method || 'nequi', // 'nequi' | 'daviplata' | 'dale'
    reference: (reference || '').trim(),
    voucherUrl: voucherUrl || null,
    extraPhotosCount: Number(extraPhotosCount) || 0,
    printedPhotosCount: Number(printedPhotosCount) || 0,
    status: 'pending', // 'pending' | 'verified'
    createdAt: new Date().toISOString()
  };

  if (!runtimeDB.payments) runtimeDB.payments = [];
  runtimeDB.payments.unshift(newPayment);

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.payments = runtimeDB.payments;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

  const photogWhatsApp1 = (runtimeDB.settings.photographerWhatsApp || '+573244725167').replace(/\D/g, '');
  const photogWhatsApp2 = (runtimeDB.settings.photographerWhatsApp2 || '+573023696513').replace(/\D/g, '');
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
    (newPayment.printedPhotosCount > 0 ? ` + ${newPayment.printedPhotosCount} fotos impresas` : '') + `\n\n` +
    `_Comprobante registrado en la plataforma. ¡Por favor verifica mi pago!_`
  );

  res.status(201).json({
    success: true,
    payment: newPayment,
    directWhatsAppUrl: `https://wa.me/${photogWhatsApp1}?text=${msgText}`,
    secondaryWhatsAppUrl: `https://wa.me/${photogWhatsApp2}?text=${msgText}`
  });
});

app.patch('/api/admin/payments/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const payment = (runtimeDB.payments || []).find(p => p.id === id);
  if (!payment) return res.status(404).json({ error: 'Pago no encontrado.' });

  payment.status = status;

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.payments = runtimeDB.payments;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

  res.json({ success: true, payment });
});

app.get('/api/admin/sessions', (req, res) => {
  const now = Date.now();
  const sessions = (runtimeDB.sessions || []).filter(s => s && s.id !== 'sess-demo' && s.token !== 'demo-cliente-2026');
  const enriched = sessions.map(s => {
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

app.delete('/api/admin/sessions/:id', (req, res) => {
  const { id } = req.params;
  const rawId = (id || '').trim();
  const cleanId = rawId.replace(/^sess-/, '');

  runtimeDB.sessions = (runtimeDB.sessions || []).filter(s => {
    if (!s) return false;
    const match = 
      s.id === rawId || 
      s.token === rawId || 
      s.id === cleanId || 
      s.token === cleanId || 
      s.id === `sess-${cleanId}` || 
      s.token === `sess-${cleanId}`;
    return !match;
  });

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.sessions = runtimeDB.sessions;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

  res.json({ success: true });
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

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.sessions = runtimeDB.sessions;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

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

app.post('/api/admin/sessions/:id/deliver', (req, res) => {
  const { id } = req.params;
  const { finalDeliveryUrl, deliveryService = 'wetransfer', deliveryNotes = '', finalPhotos = [] } = req.body;

  const session = (runtimeDB.sessions || []).find(s => s.id === id || s.token === id);
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada.' });

  session.status = 'delivered';
  session.finalDeliveryUrl = (finalDeliveryUrl || '').trim();
  session.deliveryService = deliveryService;
  session.deliveryNotes = (deliveryNotes || '').trim();
  session.deliveredAt = new Date().toISOString();
  if (Array.isArray(finalPhotos) && finalPhotos.length > 0) {
    session.finalPhotos = finalPhotos;
  }

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.sessions = runtimeDB.sessions;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

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
