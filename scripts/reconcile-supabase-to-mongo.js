import 'dotenv/config';
import { getMongoDB, isMongoConfigured } from '../api/db/mongo.js';

/**
 * Script de Reconciliación Histórica: Supabase -> MongoDB Atlas
 * Ejecutar con: node scripts/reconcile-supabase-to-mongo.js
 * 
 * Diseñado para ser 100% idempotente (se puede ejecutar múltiples veces sin duplicar datos).
 */

async function main() {
  console.log('🔄 ==============================================================');
  console.log('   RECONCILIACIÓN HISTÓRICA: SUPABASE ➔ MONGODB ATLAS');
  console.log('=================================================================\n');

  // 1. Verificar MongoDB
  if (!isMongoConfigured()) {
    console.error('❌ MONGODB_URI no está configurado en las variables de entorno.');
    process.exit(1);
  }

  const db = await getMongoDB();
  if (!db) {
    console.error('❌ No se pudo conectar a MongoDB Atlas. Verifica tu cadena de conexión.');
    process.exit(1);
  }
  console.log('✓ Conexión establecida con MongoDB Atlas');

  // 2. Verificar Supabase
  const supaUrl = process.env.SUPABASE_REST_URL || process.env.VITE_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_REST_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supaUrl || !supaKey) {
    console.error('❌ Credenciales de Supabase (SUPABASE_REST_URL / SUPABASE_REST_KEY) no encontradas en .env');
    process.exit(1);
  }

  console.log('📡 Verificando estado de Supabase...');
  try {
    const ping = await fetch(`${supaUrl}/rest/v1/catalog?limit=1`, {
      headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` }
    });

    if (ping.status === 402) {
      console.error('\n🔴 [Supabase Bloqueado - HTTP 402]');
      console.error('El proyecto de Supabase sigue restringido por cuota de salida (exceed_egress_quota).');
      console.error('👉 Debes completar el Paso 1: Ingresa a tu panel de Supabase y sube de plan o quita el spend cap.');
      console.error('Apenas esté desbloqueado, vuelve a ejecutar este script para importar tus datos históricos.\n');
      process.exit(1);
    }

    if (!ping.ok) {
      console.error(`❌ Error consultando Supabase (HTTP ${ping.status}):`, await ping.text());
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error de conexión hacia Supabase:', err.message);
    process.exit(1);
  }

  console.log('✓ Supabase está activo y respondiendo correctamente (HTTP 200).\n');

  // 3. Migrar Catálogo General (incluye reservas, pagos y sesiones empaquetadas)
  console.log('📦 Descargando tabla `catalog` de Supabase...');
  let catalogRows = [];
  try {
    const res = await fetch(`${supaUrl}/rest/v1/catalog?select=*`, {
      headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` }
    });
    if (res.ok) {
      catalogRows = await res.json();
    }
  } catch (e) {
    console.warn('⚠️ Error leyendo catalog:', e.message);
  }

  console.log(`✓ Obtenidas ${catalogRows.length} filas desde Supabase \`catalog\`.`);

  let countBookings = 0;
  let countPayments = 0;
  let countSessions = 0;
  let countReviews = 0;
  let countPhotos = 0;

  for (const row of catalogRows) {
    const cat = row.category || '';
    if (cat === 'booking_data') {
      try {
        const b = JSON.parse(row.url);
        if (b && b.id) {
          const { _id, ...clean } = b;
          await db.collection('bookings').updateOne(
            { id: b.id },
            { $set: { ...clean, supaId: row.id, updatedAt: new Date().toISOString() } },
            { upsert: true }
          );
          countBookings++;
        }
      } catch (e) {}
    } else if (cat === 'payment_data') {
      try {
        const p = JSON.parse(row.url);
        if (p && p.id) {
          const { _id, ...clean } = p;
          await db.collection('payments').updateOne(
            { id: p.id },
            { $set: { ...clean, supaId: row.id, updatedAt: new Date().toISOString() } },
            { upsert: true }
          );
          countPayments++;
        }
      } catch (e) {}
    } else if (cat === 'session_data') {
      try {
        const s = JSON.parse(row.url);
        if (s && s.id) {
          const { _id, ...clean } = s;
          await db.collection('sessions').updateOne(
            { id: s.id },
            { $set: { ...clean, supaId: row.id, updatedAt: new Date().toISOString() } },
            { upsert: true }
          );
          countSessions++;
        }
      } catch (e) {}
    } else if (cat === 'review_data') {
      try {
        const r = JSON.parse(row.url);
        if (r && r.id) {
          const { _id, ...clean } = r;
          await db.collection('reviews').updateOne(
            { id: r.id },
            { $set: { ...clean, supaId: row.id, updatedAt: new Date().toISOString() } },
            { upsert: true }
          );
          countReviews++;
        }
      } catch (e) {}
    } else if (row.url && !row.id.startsWith('system_')) {
      // Foto real del portafolio público
      await db.collection('catalog').updateOne(
        { id: row.id },
        {
          $set: {
            id: row.id,
            title: row.title || 'Foto de Portafolio',
            category: row.category || 'Retratos',
            location: row.location || 'Colombia',
            url: row.url,
            updatedAt: new Date().toISOString()
          }
        },
        { upsert: true }
      );
      countPhotos++;
    }
  }

  // 4. Migrar tabla relacional `bookings` (si se usó directamente)
  console.log('📋 Descargando tabla relacional `bookings`...');
  try {
    const resB = await fetch(`${supaUrl}/rest/v1/bookings?select=*`, {
      headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` }
    });
    if (resB.ok) {
      const rows = await resB.json();
      for (const b of rows) {
        if (b && b.id) {
          const formatted = {
            id: b.id,
            clientName: b.client_name,
            clientWhatsApp: b.client_whatsapp,
            clientEmail: b.client_email,
            packageId: b.package_id,
            packageName: b.package_name,
            totalPrice: Number(b.total_price || 0),
            locationType: b.location_type,
            specificLocation: b.specific_location,
            dateTime: b.date_time,
            description: b.description,
            status: b.status,
            createdAt: b.created_at,
            isReal: true,
            updatedAt: new Date().toISOString()
          };
          await db.collection('bookings').updateOne(
            { id: b.id },
            { $set: formatted },
            { upsert: true }
          );
          countBookings++;
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ Error leyendo tabla bookings:', e.message);
  }

  // 5. Migrar tabla relacional `payments`
  console.log('💳 Descargando tabla relacional `payments`...');
  try {
    const resP = await fetch(`${supaUrl}/rest/v1/payments?select=*`, {
      headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` }
    });
    if (resP.ok) {
      const rows = await resP.json();
      for (const p of rows) {
        if (p && p.id) {
          const formatted = {
            id: p.id,
            bookingId: p.booking_id,
            amount: Number(p.amount || 0),
            paymentMethod: p.method,
            status: p.status,
            reference: p.reference,
            createdAt: p.created_at,
            updatedAt: new Date().toISOString()
          };
          await db.collection('payments').updateOne(
            { id: p.id },
            { $set: formatted },
            { upsert: true }
          );
          countPayments++;
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ Error leyendo tabla payments:', e.message);
  }

  console.log('\n=================================================================');
  console.log('🎉 RECONCILIACIÓN COMPLETADA EXITOSAMENTE EN MONGODB ATLAS:');
  console.log(`   📅 Reservas consolidadas: ${countBookings}`);
  console.log(`   💳 Pagos registrados:     ${countPayments}`);
  console.log(`   📸 Sesiones / Galerías:   ${countSessions}`);
  console.log(`   ⭐ Reseñas de clientes:   ${countReviews}`);
  console.log(`   🖼️ Fotos de catálogo:     ${countPhotos}`);
  console.log('=================================================================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Error fatal durante la reconciliación:', err);
  process.exit(1);
});
