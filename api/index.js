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
      { id: 'cat-1789949201412', title: 'Feliz cumpleaños Daniela', category: 'Retratos', location: 'San Antero', url: 'https://scontent.feoh11-1.fna.fbcdn.net/v/t39.30808-6/763263363_27769661346019254_2831021147931490255_n.jpg?stp=dst-jpg_tt6&cstp=mx2048x1365&ctp=s2048x1365&_nc_cat=105&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=833d8c&_nc_eui2=AeFK2MmAZOr6vbtkCePM3oMa70KS3PO4Rk3vQpLc87hGTYp97ekuM7AUe7JNF_T3YN7GkpoVLxECCI9Hf0xWFJbl&_nc_ohc=HVQNDynGnSQQ7kNvwFrr4DS&_nc_oc=AdpUXJ7bfsadj7zZrrE5LhiyxElRrBcvwBCNC8VF8G2wMUeuCF4i4K-PdImQTu-B67M&_nc_zt=23&_nc_ht=scontent.feoh11-1.fna&_nc_gid=hnyT16mXfsVzQ0Kbg8mSNQ&_nc_ss=7b2a8&oh=00_AQIMJkiYGuLnzaEpJOSxnnuxLr8TgK0pMhNLlxbdiddj5g&oe=6AB63E9F' },
      { id: 'cat-1789949301568', title: 'Jesús, un niño lleno de alegría', category: 'Retratos', location: 'San Antero', url: 'https://scontent.feoh11-1.fna.fbcdn.net/v/t39.30808-6/763811115_27751442097841179_6934901430669706693_n.jpg?stp=dst-jpg_tt6&cstp=mx1365x2048&ctp=s1365x2048&_nc_cat=105&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=833d8c&_nc_eui2=AeGk29Dg3bvs4R7VJW1x2wAchxUJiKas_5CHFQmIpqz_kFQwMGo3DwIbLmDxTiuMN-xO9kNT8HVAZPgLxq6kZvBg&_nc_ohc=JrbF6DoCnocQ7kNvwGjG-ij&_nc_oc=AdpKLFib_hh3frPl6sIg7dUMlJGDxcPFQPb9QeAcqcmCwCnabv1KbGqmBb11HHw47nc&_nc_zt=23&_nc_ht=scontent.feoh11-1.fna&_nc_gid=CDdXinlXPtAZsoqR1teDyw&_nc_ss=7b2a8&oh=00_AQIcWB4_Iaj-BAlIWDt3zNJ_ysula_VZGx0fq4TE-pqpzw&oe=6AB65FB6' },
      { id: 'cat-1789949471911', title: 'Feliz cumpleaños Julieta', category: 'Retratos', location: 'San Antero', url: 'https://scontent.feoh11-1.fna.fbcdn.net/v/t39.30808-6/762623951_27743862695265786_1424961646463226678_n.jpg?stp=dst-jpg_tt6&cstp=mx1365x2048&ctp=s1365x2048&_nc_cat=105&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=833d8c&_nc_eui2=AeF2QKUgRK29fzWCNvnuA45y4txfJae0MDni3F8lp7QwOeIteHunfXvQyBEoEW2xoVBziD-rtvxu5huS4ns0ZaAk&_nc_ohc=6gGwZEaPrVQQ7kNvwErDxKQ&_nc_oc=Adrec-DCGOLcdbm2PQK6iqKRpTR3kCre-4Zo5I_XC6L1fwqGPtDGnQ_vSy9m9u39WvA&_nc_zt=23&_nc_ht=scontent.feoh11-1.fna&_nc_gid=cvxt4d-Kx6C3QGogn3PiSQ&_nc_ss=7b2a8&oh=00_AQLmcJgbxy40HNxTh2c4-if1nZ2zxnhu7Xt43OpCmhG98A&oe=6AB64CF7' },
      { id: 'cat-1789951307326', title: 'Los 6 años de Christy', category: 'Retratos', location: 'San Antero', url: 'https://scontent.feoh11-1.fna.fbcdn.net/v/t39.30808-6/757683380_27677700725215317_3242299853726830339_n.jpg?stp=dst-jpg_tt6&cstp=mx1365x2048&ctp=s1365x2048&_nc_cat=103&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=833d8c&_nc_eui2=AeEy6qOYv8vQGHxhFG8TljDdyuX84aCmbezK5fzhoKZt7CMYrjWoxbg50OMReZnWd9BqBRzOEj9Vdlg1-2GOAeeR&_nc_ohc=JNz7Jov1S4AQ7kNvwGbN3L4&_nc_oc=Adrm2cdpFV_racPTNZ3LSIqbQZVQ6ElmUaqd2OFhOyzHqs3oF_fXtAVpLYyE5u6aWuU&_nc_zt=23&_nc_ht=scontent.feoh11-1.fna&_nc_gid=K4GlbtJrGGa_fvyCtHayKg&_nc_ss=7b2a8&oh=00_AQLjBHDBDhYCvrQezJ1ygCkDnWhHR-08ilkMJxvNkQf93Q&oe=6AB6630E' },
      { id: 'cat-1789951453602', title: 'Felices 16', category: 'Retratos', location: 'San Antero', url: 'https://scontent.feoh11-1.fna.fbcdn.net/v/t39.30808-6/748452814_27524706577181400_2836072191433544136_n.jpg?stp=dst-jpg_tt6&cstp=mx1023x1537&ctp=s1023x1537&_nc_cat=109&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=833d8c&_nc_eui2=AeHerpZDDf-IYgYxcjw58XWbq2BgvNJ4ckyrYGC80nhyTDRFPTvL0IpfVWUDBJWpDj6HtYmbmUhYJztMCexCzbpX&_nc_ohc=nAC2cK4GoTQQ7kNvwFy0tJN&_nc_oc=AdqHhO-raVhBIxqlEmu4Zs67aXVX3yAwob28sVvCDLVXTTeNpueltKAwnZJEi0ghjHo&_nc_zt=23&_nc_ht=scontent.feoh11-1.fna&_nc_gid=5J8myCjLK5Sv8EwRtE2cXQ&_nc_ss=7b2a8&oh=00_AQLkZy6VLNukagguNFnX63pp_-B_jnq1ArU6bKhlrpzP8w&oe=6AB635FE' },
      { id: 'cat-1789951546306', title: 'Los 9 meses de Celeste', category: 'Retratos', location: 'San Antero', url: 'https://scontent.feoh11-1.fna.fbcdn.net/v/t39.30808-6/744441006_27499813676337357_3811283654705731568_n.jpg?stp=dst-jpg_tt6&cstp=mx1773x2048&ctp=s1773x2048&_nc_cat=103&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=833d8c&_nc_eui2=AeGevy9HYLfPIFgo7LHHF4oy9UEhtTy5q4T1QSG1PLmrhNOMRc2NHBRPzgZ3Ro06gngSG1QRf_D7N6C4BZGYc31j&_nc_ohc=qVePAMvxR5oQ7kNvwGZm8-U&_nc_oc=AdpV8u2kID_euQc7voMs5TwJLf18Nu6kcxnUpB-_WW4bufeBi3jrpaF_DxkVImoWxAQ&_nc_zt=23&_nc_ht=scontent.feoh11-1.fna&_nc_gid=OKgQEvgBAIvErYCvQnhSug&_nc_ss=7b2a8&oh=00_AQKesBDDNd0sj8cxICOk3FYR1yrysv4taOB2tOce0Wtdhg&oe=6AB649FC' },
      { id: 'cat-1789951644266', title: 'celebramos un cumpleaños rodeado de la magia  Ayda Luz', category: 'Retratos', location: 'San Antero', url: 'https://scontent.feoh11-1.fna.fbcdn.net/v/t39.30808-6/740286444_27443499005302158_8239489183271872849_n.jpg?stp=dst-jpg_tt6&cstp=mx1365x2048&ctp=s1365x2048&_nc_cat=106&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=833d8c&_nc_eui2=AeHlZBT0THzBFxw9dIq4g5VDrDZ2oaN00WasNnaho3TRZjOTjJ4RWeW7CYkhfMSb0WbGeujSF6hRv_wxxWsHPpvz&_nc_ohc=IoLhyAxLueQQ7kNvwHAfliS&_nc_oc=AdobJOqCiHdcuWpyeTAgvTISbmCQcjom5s5fOco3dFb2FPex1yhnaenG-UDMsmZSAP4&_nc_zt=23&_nc_ht=scontent.feoh11-1.fna&_nc_gid=kl__j7PnbAotnRTkAkQMJg&_nc_ss=7b2a8&oh=00_AQJPuJNM0aXLe9jhyd6u4VBBAYR7Jg-PPLi-4shwIUFgjA&oe=6AB66349' },
      { id: 'cat-1789951931767', title: 'Una sesión llena de amor, ilusión', category: 'Retratos', location: 'San Antero', url: 'https://scontent.feoh11-1.fna.fbcdn.net/v/t39.30808-6/738593738_27430333576618701_5848312975645046731_n.jpg?stp=dst-jpg_tt6&cstp=mx1536x1024&ctp=s1536x1024&_nc_cat=109&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=833d8c&_nc_eui2=AeGhU7j-ibxEg48pN7p7siDOSafNXnzEYOJJp81efMRg4qYrn5tIdiwi-0Cf_5mNN1QN47Ihp0BQ3pQnWxQrat5Y&_nc_ohc=DkYSxRyduEsQ7kNvwEv9Dsp&_nc_oc=AdpmeamyGGZnWEYNB5E3n8b9FewnBQih6c6l_Pk3VcBOr1EZWa6c2T9BLQmmeFQdDmQ&_nc_zt=23&_nc_ht=scontent.feoh11-1.fna&_nc_gid=BwALJ11T70_H6fh0nLBCkQ&_nc_ss=7b2a8&oh=00_AQJvI9O5Fo0o0vw2zbCQyxKv7tuOMeydUae9BWiMkDp7eA&oe=6AB66579' },
      { id: 'cat-1789952024846', title: 'Feliz primer cumpleaños, Shamara', category: 'Retratos', location: 'San Antero', url: 'https://scontent.feoh11-1.fna.fbcdn.net/v/t39.30808-6/736020236_27414428354875890_8160280850186956763_n.jpg?stp=dst-jpg_tt6&cstp=mx1365x2048&ctp=s1365x2048&_nc_cat=102&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=833d8c&_nc_eui2=AeH4gFToLvYtuiJcLMM7tSSqfzD0cSWU_1h_MPRxJZT_WBuvxf9B_XAk5BqbTKL3dHgN9xQQ_kHAA_tTXurU8j0v&_nc_ohc=jE3dEq1FOyUQ7kNvwE9_KB8&_nc_oc=AdruTT4YZ8AcwIniNVcJepqxGOvWbJ1YOQ9TrFxRs5F2hdP329VzBZYBkH3NAgxcFOE&_nc_zt=23&_nc_ht=scontent.feoh11-1.fna&_nc_gid=R0VOeQxMCFwiWLhA1lVeKQ&_nc_ss=7b2a8&oh=00_AQJZSrPhsmPe9MbaIUqGCDsnFpNz3vUCW2gv_fDoUKNGSg&oe=6AB66E0B' }
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
    sessions: []
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

  try {
    const dbPath = path.join(process.cwd(), 'server', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const current = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      current.bookings = runtimeDB.bookings;
      fs.writeFileSync(dbPath, JSON.stringify(current, null, 2));
    }
  } catch (e) {}

  const photogWhatsApp1 = (runtimeDB.settings.photographerWhatsApp || '+573244725167').replace(/\D/g, '');
  const photogWhatsApp2 = (runtimeDB.settings.photographerWhatsApp2 || '+573023696513').replace(/\D/g, '');
  const msgText = encodeURIComponent(
    `📸 *¡Hola Sebastian G! Acabo de hacer una reserva en tu sitio web:*\n\n` +
    `👤 *Nombre:* ${newBooking.clientName}\n` +
    `📱 *WhatsApp:* ${newBooking.clientWhatsApp}\n` +
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
  const sessions = (runtimeDB.sessions || []).filter(s => s && s.clientName !== 'Camila Rodríguez' && s.id !== 'sess-demo' && s.token !== 'demo-cliente-2026');
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
  runtimeDB.sessions = (runtimeDB.sessions || []).filter(s => s.id !== id && s.token !== id);

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
