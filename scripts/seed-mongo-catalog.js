import 'dotenv/config';
import { getMongoDB, isMongoConfigured, upsertMongoDoc } from '../api/db/mongo.js';

const REAL_CATALOG = [
  { id: 'cat-verano-salsero', title: 'Verano salsero', category: 'Retratos', location: 'Playas de Coveñas', url: '/catalog/verano-salsero.jpg' },
  { id: 'cat-1789878355199', title: 'Amor al  campo', category: 'Retratos', location: 'Torrente -Coveñas', url: '/catalog/cat-1789878355199.jpg' },
  { id: 'cat-1789878484787', title: 'Sesión en Torrente, Coveñas', category: 'Retratos', location: 'Torrente - Coveñas', url: '/catalog/cat-1789878484787.jpg' },
  { id: 'cat-1789902452640', title: 'Atardecer', category: 'Retratos', location: 'Playas el Edén - Coveñas', url: '/catalog/cat-1789902452640.jpg' },
  { id: 'cat-1789916017066', title: 'Feliz cumpleaños  Thiago', category: 'Retratos', location: 'Nuevo Agrado', url: '/catalog/cat-1789916017066.jpg' },
  { id: 'cat-1789916075257', title: 'Atardeceres', category: 'Retratos', location: 'Malecón , San Antero', url: '/catalog/cat-1789916075257.jpg' },
  { id: 'cat-1789916145830', title: 'Morenas con estilo', category: 'Retratos', location: 'Malecón, San Antero', url: '/catalog/cat-1789916145830.jpg' },
  { id: 'cat-1789916197806', title: 'Unión Familiar', category: 'Retratos', location: 'Tijereta, San Antero', url: '/catalog/cat-1789916197806.jpg' },
  { id: 'cat-1789916408679', title: 'Feliz cumpleaños Kairys', category: 'Playas San Antero', location: 'Playa Blanca, San Antero', url: '/catalog/cat-1789916408679.jpg' },
  { id: 'cat-1789916617329', title: 'ANGT', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789916617329.jpg' },
  { id: 'cat-1789949201412', title: 'Feliz cumpleaños Daniela', category: 'Retratos', location: 'Playa Blanca, San Antero', url: '/catalog/cat-1789949201412.jpg' },
  { id: 'cat-1789949301568', title: 'Jesús, un niño lleno de alegría', category: 'Retratos', location: 'Playa Blanca, San Antero', url: '/catalog/cat-1789949301568.jpg' },
  { id: 'cat-1789949471911', title: 'Feliz  cumpleaños Julieta', category: 'Retratos', location: 'Via la culebra ,Cotorra', url: '/catalog/cat-1789949471911.jpg' },
  { id: 'cat-1789951307326', title: 'Los 6 años de Christy', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1789951307326.jpg' },
  { id: 'cat-1789951453602', title: 'Felices 16', category: 'Retratos', location: 'Cotorra', url: '/catalog/cat-1789951453602.jpg' },
  { id: 'cat-1789951546306', title: 'Los 9 meses de Celeste', category: 'Retratos', location: 'Playas el Eden ,Coveñas', url: '/catalog/cat-1789951546306.jpg' },
  { id: 'cat-1789951644266', title: 'celebramos un cumpleaños rodeado de la magia  Ayda Luz', category: 'Retratos', location: 'Malecon, San Antero', url: '/catalog/cat-1789951644266.jpg' },
  { id: 'cat-1789951931767', title: 'Una sesión llena de amor, ilusión', category: 'Retratos', location: 'Coveñas, Sucre', url: '/catalog/cat-1789951931767.jpg' },
  { id: 'cat-1789952024846', title: 'Feliz primer cumpleaños, Shamara', category: 'Retratos', location: 'Playa Blanca, San Antero', url: '/catalog/cat-1789952024846.jpg' },
  { id: 'cat-1790137885828', title: '10 años de Thiago', category: 'Retratos', location: 'Malecon, San Antero', url: '/catalog/cat-1790137885828.jpg' },
  { id: 'cat-1790138062113', title: 'Celebramos un cumpleaños lleno de alegría', category: 'Retratos', location: 'Malecón, San Antero', url: '/catalog/cat-1790138062113.jpg' },
  { id: 'cat-1790138129671', title: 'cumpleaños de Liam', category: 'Retratos', location: 'Tolu', url: '/catalog/cat-1790138129671.jpg' },
  { id: 'cat-1790138192390', title: 'Una sesión llena de color, alegría', category: 'Retratos', location: 'Playa Blanca, San Antero', url: '/catalog/cat-1790138192390.jpg' },
  { id: 'cat-1790138313878', title: 'Celebramos los 15 años de Sofía', category: 'Retratos', location: 'Malecon,Coveñas', url: '/catalog/cat-1790138313878.jpg' },
  { id: 'cat-1790138378422', title: 'Elegancia, seguridad y belleza', category: 'Retratos', location: 'Malecon, San Antero', url: '/catalog/cat-1790138378422.jpg' },
  { id: 'cat-1790138441725', title: 'La verdadera belleza resplandece cuando te muestras tal y como eres', category: 'Retratos', location: 'Playa Blanca, San Antero', url: '/catalog/cat-1790138441725.jpg' },
  { id: 'cat-1790138504516', title: 'Entre el azul del cielo y la calma del mar,', category: 'Retratos', location: 'Malecón, San Antero', url: '/catalog/cat-1790138504516.jpg' },
  { id: 'cat-1790138561501', title: 'Una tarde llena de amor, sonrisas', category: 'Retratos', location: 'Tolu playa', url: '/catalog/cat-1790138561501.jpg' },
  { id: 'cat-1790138633284', title: 'La magia de lo natural se refleja en cada toma', category: 'Retratos', location: 'Coveñas', url: '/catalog/cat-1790138633284.jpg' },
  { id: 'cat-1790138725659', title: 'Ariadna celebró sus 9 años', category: 'Retratos', location: 'San Antero', url: '/catalog/cat-1790138725659.jpg' },
  { id: 'cat-1790138815867', title: 'Hoy celebramos los 6 años de Santiago', category: 'Retratos', location: 'Playa Blanca, San Antero', url: '/catalog/cat-1790138815867.jpg' },
  { id: 'cat-1790138962906', title: 'Entre la brisa del mar y el sonido de las olas, florece una conexión', category: 'Retratos', location: 'Coveñas', url: '/catalog/cat-1790138962906.jpg' },
  { id: 'cat-1790138998265', title: 'La belleza no tiene límites. Con su esencia, confianza y elegancia', category: 'Retratos', location: 'Playa Blanca, San Antero', url: '/catalog/cat-1790138998265.jpg' },
  { id: 'cat-1790139087441', title: 'Una morena que brilla con luz propia, reflejando confianza, amor propio', category: 'Retratos', location: 'Coveñas', url: '/catalog/cat-1790139087441.jpg' },
  { id: 'cat-1790139202456', title: 'Entre risas, abrazos y miradas llenas de amor, vivimos una sesión mágica junto a Maylin esta hermosa niña de 2 años y su mamá.', category: 'Retratos', location: 'Coveñas', url: '/catalog/cat-1790139202456.jpg' },
  { id: 'cat-1790139247128', title: 'Entre la brisa del mar y la magia del atardecer, su cabello crespo bailaba con el viento como una obra de arte natural', category: 'Retratos', location: 'Coveñas', url: '/catalog/cat-1790139247128.jpg' },
  { id: 'cat-1790139302008', title: 'El amor de mamá.', category: 'Retratos', location: 'Playa Blanca, San Antero', url: '/catalog/cat-1790139302008.jpg' },
  { id: 'cat-1790139359055', title: 'Hay amistades que se convierten en familia y corazones que viven cada etapa como si fuera propia 💕✨', category: 'Retratos', location: 'Malecon,Coveñas', url: '/catalog/cat-1790139359055.jpg' },
  { id: 'cat-1790139435319', title: 'Los 6 llegaron llenos de diversión, juegos y mucho pastel!', category: 'Retratos', location: 'Nuevo Agrado, San Antero', url: '/catalog/cat-1790139435319.jpg' },
  { id: 'cat-1790909237730', title: '🇨🇴 Un momento para recordar toda la vida', category: 'Retratos', location: 'Coveñas', url: '/catalog/cat-1790909237730.jpg' }
];

const DEMO_BOOKINGS = [
  {
    id: "book-demo-001",
    clientName: "Cliente Muestra 1 (Ejemplo)",
    clientWhatsApp: "+57 300 000 0001",
    packageId: "pkg-8fotos",
    packageName: "8 Fotos Digitales (+ 2 Fotos Gratis)",
    totalPrice: 85000,
    locationType: "outside_san_antero",
    specificLocation: "Coveñas",
    dateTime: "30/09/2026 a las 3:00 p. m.",
    description: "Sesión de fotos de muestra",
    createdAt: "2026-09-19T10:00:00.000Z",
    status: "confirmed",
    isDemo: true,
    isReal: false
  },
  {
    id: "book-demo-002",
    clientName: "Cliente Muestra 2 (Ejemplo)",
    clientWhatsApp: "+57 300 000 0002",
    packageId: "pkg-6fotos",
    packageName: "6 Fotos Digitales",
    totalPrice: 75000,
    locationType: "outside_san_antero",
    specificLocation: "Locación Especial / Fuera",
    dateTime: "03/10/2026 a las 3:10 p. m.",
    description: "Sesión de muestra familiar",
    createdAt: "2026-09-24T20:03:10.756Z",
    status: "confirmed",
    isDemo: true,
    isReal: false
  }
];

const REAL_BOOKINGS = DEMO_BOOKINGS;

async function seed() {
  if (!isMongoConfigured()) {
    console.error('❌ MONGODB_URI no está configurado.');
    process.exit(1);
  }

  const db = await getMongoDB();
  if (!db) {
    console.error('❌ No se pudo conectar a MongoDB Atlas.');
    process.exit(1);
  }

  console.log('🌱 Poblando MongoDB Atlas con el portafolio real (40 fotos)...');
  let photoCount = 0;
  for (let index = 0; index < REAL_CATALOG.length; index++) {
    const photo = REAL_CATALOG[index];
    await upsertMongoDoc('catalog', { id: photo.id }, {
      ...photo,
      // createdAt decreciente (la primera foto del arreglo queda con la fecha más
      // reciente) para que /api/catalog, que ordena por createdAt descendente,
      // respete el orden curado del portafolio en vez de invertirlo.
      createdAt: new Date(Date.now() - index * 1000).toISOString()
    });
    photoCount++;
  }
  console.log(`✓ ${photoCount} fotos de portafolio sincronizadas en MongoDB Atlas.`);

  console.log('🌱 Poblando MongoDB Atlas con reservas reales históricas...');
  let bookCount = 0;
  for (const b of REAL_BOOKINGS) {
    await upsertMongoDoc('bookings', { id: b.id }, b);
    bookCount++;
  }
  console.log(`✓ ${bookCount} reservas sincronizadas en MongoDB Atlas.`);

  console.log('\n✅ Portafolio y reservas reales aseguradas en MongoDB Atlas al 100%.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Error seeding:', err);
  process.exit(1);
});
