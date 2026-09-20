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
      photographerWhatsApp: "+573001234567",
      outOfSanAnteroSurcharge: 10000,
      currencySymbol: "$",
      tagline: "Capturamos momentos, creamos recuerdos. ♡",
      watermarkText: "SEBASTIAN G",
      watermarkSubtext: "MUESTRA EXCLUSIVA • PROHIBIDA SU DESCARGA",
      watermarkLogoUrl: "/logo-white.png",
      adminPin: "1234",
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
      { id: "cat-1", title: "Atardecer en Playa Blanca", category: "Playas San Antero", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80", location: "Playa Blanca, San Antero" },
      { id: "cat-2", title: "Retrato Urbano & Estilo", category: "Retratos", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80", location: "San Antero" },
      { id: "cat-3", title: "Amor Frente al Mar", category: "Parejas & Bodas", url: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&w=1000&q=80", location: "Punta Bolívar" },
      { id: "cat-4", title: "Sesión Quinceañera Tropical", category: "Quinceañeras", url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=80", location: "San Antero" }
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

  const photogWhatsApp = (runtimeDB.settings.photographerWhatsApp || '+573001234567').replace(/\D/g, '');
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
    directWhatsAppUrl: `https://wa.me/${photogWhatsApp}?text=${msgText}`
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

  session.status = 'submitted';
  session.submittedAt = new Date().toISOString();

  res.json({
    success: true,
    message: '¡Selección guardada con éxito!'
  });
});

app.post('/api/admin/auth', (req, res) => {
  const { pin } = req.body;
  if (pin === runtimeDB.settings.adminPin) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'PIN incorrecto.' });
  }
});

app.get('/api/admin/bookings', (req, res) => {
  res.json(runtimeDB.bookings || []);
});

app.get('/api/admin/sessions', (req, res) => {
  res.json(runtimeDB.sessions || []);
});

export default app;
