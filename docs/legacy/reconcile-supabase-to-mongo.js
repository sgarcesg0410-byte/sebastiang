import 'dotenv/config';
import { getMongoDB, isMongoConfigured } from '../api/db/mongo.js';

/**
 * Script de Reconciliación Histórica: Supabase -> MongoDB Atlas
 * Ejecutar con: node scripts/reconcile-supabase-to-mongo.js
 *
 * Diseñado para ser 100% idempotente (se puede ejecutar múltiples veces sin duplicar datos).
 */

const supaUrl = process.env.SUPABASE_REST_URL || process.env.VITE_SUPABASE_URL;
// Prioriza service_role (lee todo aunque haya RLS), luego la clave configurada, luego la anon.
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_REST_KEY
  || process.env.VITE_SUPABASE_ANON_KEY;

/**
 * Descarga TODAS las filas de una tabla/endpoint de Supabase usando paginación.
 * Supabase por defecto devuelve un máximo de 1000 filas por petición; sin paginar,
 * cualquier negocio con más de 1000 registros perdería datos en la migración.
 */
async function fetchAllSupa(path) {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    let res;
    try {
      res = await fetch(`${supaUrl}/rest/v1/${path}${sep}limit=${pageSize}&offset=${offset}`, {
        headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` }
      });
    } catch (err) {
      console.warn(`⚠️ Error de red leyendo ${path}:`, err.message);
      break;
    }
    if (!res.ok) {
      console.warn(`⚠️ Error HTTP ${res.status} leyendo ${path}:`, (await res.text()).slice(0, 200));
      break;
    }
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

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

  // 3. Migrar Catálogo General (incluye reservas, pagos, sesiones, VIP y fotos empaquetadas)
  console.log('📦 Descargando tabla `catalog` de Supabase (con paginación)...');
  const catalogRows = await fetchAllSupa('catalog?select=*');
  console.log(`✓ Obtenidas ${catalogRows.length} filas desde Supabase \`catalog\`.`);

  // Conteos únicos (por id) para que el reporte final sea exacto aunque
  // el mismo registro aparezca tanto en `catalog` como en su tabla relacional.
  const seenBookings = new Set();
  const seenPayments = new Set();
  const seenSessions = new Set();
  const seenReviews = new Set();
  const seenVips = new Set();
  const seenPhotos = new Set();

  for (const row of catalogRows) {
    const cat = row.category || '';
    const id = row.id || '';
    const isPrivate = id.startsWith('system_') || id.startsWith('sess-') || id.startsWith('book-')
      || id.startsWith('pay-') || id.startsWith('rev-') || id.startsWith('vip-')
      || cat.endsWith('_data') || cat === 'vip_client';

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
          seenBookings.add(b.id);
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
          seenPayments.add(p.id);
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
          seenSessions.add(s.id);
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
          seenReviews.add(r.id);
        }
      } catch (e) {}
    } else if (cat === 'vip_client') {
      // Clientes VIP: el JSON completo va a la colección `vip_clients`,
      // que es la que consulta el backend (`GET /api/admin/vip`).
      try {
        const v = JSON.parse(row.url);
        if (v && (v.id || v.clientWhatsApp || v.phone)) {
          const vipId = v.id || `vip-${String(v.clientWhatsApp || v.phone || '').replace(/\D/g, '')}`;
          const { _id, ...clean } = v;
          await db.collection('vip_clients').updateOne(
            { id: vipId },
            { $set: { ...clean, id: vipId, updatedAt: new Date().toISOString() } },
            { upsert: true }
          );
          seenVips.add(vipId);
        }
      } catch (e) {}
    } else if (row.url && !isPrivate && id && !id.startsWith('vip-')) {
      // Foto real del portafolio público (cat-* y categorías no privadas).
      await db.collection('catalog').updateOne(
        { id },
        {
          $set: {
            id,
            title: row.title || 'Foto de Portafolio',
            category: row.category || 'Retratos',
            location: row.location || 'Colombia',
            url: row.url,
            updatedAt: new Date().toISOString()
          }
        },
        { upsert: true }
      );
      seenPhotos.add(id);
    }
  }

  // 4. Migrar tabla relacional `bookings` (si se usó directamente)
  console.log('📋 Descargando tabla relacional `bookings`...');
  const relBookings = await fetchAllSupa('bookings?select=*');
  for (const b of relBookings) {
    if (!b || !b.id) continue;
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
    seenBookings.add(b.id);
  }

  // 5. Migrar tabla relacional `payments`
  console.log('💳 Descargando tabla relacional `payments`...');
  const relPayments = await fetchAllSupa('payments?select=*');
  for (const p of relPayments) {
    if (!p || !p.id) continue;
    const formatted = {
      id: p.id,
      clientName: p.client_name,
      clientWhatsApp: p.client_whatsapp,
      sessionToken: p.session_token || p.booking_id || '',
      bookingId: p.booking_id,
      amount: Number(p.amount || 0),
      method: p.method,
      status: p.status,
      reference: p.reference,
      concept: p.concept,
      createdAt: p.created_at,
      updatedAt: new Date().toISOString()
    };
    await db.collection('payments').updateOne(
      { id: p.id },
      { $set: formatted },
      { upsert: true }
    );
    seenPayments.add(p.id);
  }

  console.log('\n=================================================================');
  console.log('🎉 RECONCILIACIÓN COMPLETADA EXITOSAMENTE EN MONGODB ATLAS:');
  console.log(`   📅 Reservas consolidadas: ${seenBookings.size}`);
  console.log(`   💳 Pagos registrados:     ${seenPayments.size}`);
  console.log(`   📸 Sesiones / Galerías:   ${seenSessions.size}`);
  console.log(`   ⭐ Reseñas de clientes:   ${seenReviews.size}`);
  console.log(`   🏆 Clientes VIP:          ${seenVips.size}`);
  console.log(`   🖼️ Fotos de catálogo:     ${seenPhotos.size}`);
  console.log('=================================================================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Error fatal durante la reconciliación:', err);
  process.exit(1);
});
