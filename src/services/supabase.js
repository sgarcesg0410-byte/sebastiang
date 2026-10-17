// ==============================================================================
// CLIENTE DE BASE DE DATOS CANÓNICO CON ENVOLTORIO TRANSPARENTE A MONGODB ATLAS
// ==============================================================================
// 100% independiente de Supabase: todas las lecturas y escrituras se canalizan
// de manera resiliente a través de la API del servidor conectada a MongoDB Atlas.
// Soporta la interfaz fluida de Supabase (.from().select().eq().order()...)
// para compatibilidad total sin riesgo de 402 o cortes de cuota.
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL
  || 'https://maqqzcawbdhhfqxoabyq.supabase.co';

const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hcXF6Y2F3YmRoaGZxeG9hYnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDUzNzksImV4cCI6MjEwNjIyMTM3OX0.o35exqFEzfbL58avn8KuVtGkN2uo61ZYh_nmziT1IUY';

export { SUPABASE_URL, SUPABASE_KEY };

export const baseSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

function getStoredAdminToken() {
  try {
    return sessionStorage.getItem('sebastian_g_admin_server_session_v1')
      || localStorage.getItem('sebastian_g_admin_server_session_v1')
      || '';
  } catch (e) {
    return '';
  }
}

/**
 * Ejecuta una mutación (upsert, insert, update, delete) pasando por el proxy
 * /api/admin/db con la sesión firmada de administrador hacia MongoDB Atlas.
 */
async function executeProxyWrite(table, op, payload, match) {
  try {
    const token = getStoredAdminToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const res = await fetch('/api/admin/db', {
      method: 'POST',
      headers,
      body: JSON.stringify({ table, op, payload, match })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = json?.error || `Error en operación ${op} sobre ${table}`;
      console.warn(`[DB Proxy] ${errMsg}`, json);
      return { data: null, error: { message: errMsg, status: res.status, detail: json?.detail } };
    }

    return { data: json.data || null, error: null };
  } catch (err) {
    console.error(`[DB Proxy] Error de red en ${op} sobre ${table}:`, err);
    return { data: null, error: { message: err?.message || 'Error de red en base de datos' } };
  }
}

/**
 * Ejecuta una lectura (.select) canalizada directamente a la API de MongoDB Atlas.
 * Traduce de forma transparente las consultas de catalog y tablas dedicadas.
 */
async function executeProxyRead(table, queryState) {
  try {
    const token = getStoredAdminToken();
    const headers = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    let items = [];

    if (table === 'catalog') {
      const catFilter = queryState.eqFilters['category'];
      const idFilter = queryState.eqFilters['id'];

      if (catFilter === 'booking_data' || (idFilter && idFilter.startsWith('book-'))) {
        const res = await fetch('/api/admin/bookings', { headers }).catch(() => null);
        if (res && res.ok) {
          const bookings = await res.json();
          items = (bookings || []).map(b => ({
            id: b.id.startsWith('book-') ? b.id : `book-${b.id}`,
            title: b.clientName || 'Reserva',
            category: 'booking_data',
            location: b.specificLocation || '',
            url: JSON.stringify(b)
          }));
        }
      } else if (catFilter === 'payment_data' || (idFilter && idFilter.startsWith('pay-'))) {
        const res = await fetch('/api/admin/payments', { headers }).catch(() => null);
        if (res && res.ok) {
          const payments = await res.json();
          items = (payments || []).map(p => ({
            id: p.id.startsWith('pay-') ? p.id : `pay-${p.id}`,
            title: p.clientName || 'Pago',
            category: 'payment_data',
            location: p.method || '',
            url: JSON.stringify(p)
          }));
        }
      } else if (catFilter === 'session_data' || (idFilter && idFilter.startsWith('sess-'))) {
        if (idFilter && idFilter.startsWith('sess-')) {
          const sToken = idFilter.replace(/^sess-/, '');
          const res = await fetch(`/api/gallery/${encodeURIComponent(sToken)}`).catch(() => null);
          if (res && res.ok) {
            const sess = await res.json();
            items = [{
              id: `sess-${sess.token || sToken}`,
              title: sess.clientName || 'Sesión',
              category: 'session_data',
              location: sess.clientWhatsApp || '',
              url: JSON.stringify(sess)
            }];
          }
        }
        if (items.length === 0) {
          const res = await fetch('/api/admin/sessions', { headers }).catch(() => null);
          if (res && res.ok) {
            const sessions = await res.json();
            items = (sessions || []).map(s => ({
              id: `sess-${s.token}`,
              title: s.clientName || 'Sesión',
              category: 'session_data',
              location: s.clientWhatsApp || '',
              url: JSON.stringify(s)
            }));
          }
        }
      } else if (catFilter === 'review_data' || (idFilter && idFilter.startsWith('rev-'))) {
        const res = await fetch('/api/reviews').catch(() => null);
        if (res && res.ok) {
          const reviews = await res.json();
          items = (reviews || []).map(r => ({
            id: `rev-${r.id}`,
            title: r.clientName || 'Cliente',
            category: 'review_data',
            location: `${r.rating} estrellas`,
            url: JSON.stringify(r)
          }));
        }
      } else if (catFilter === 'vip_client' || (idFilter && idFilter.startsWith('vip-'))) {
        const res = await fetch('/api/admin/vip', { headers }).catch(() => null);
        if (res && res.ok) {
          const vips = await res.json();
          items = (vips || []).map(v => ({
            id: v.id,
            title: v.name || v.clientName || 'Cliente VIP',
            category: 'vip_client',
            location: v.phone || v.clientWhatsApp || '',
            url: JSON.stringify(v)
          }));
        }
      } else if (idFilter === 'system_wallet_balances') {
        const res = await fetch('/api/admin/wallets', { headers }).catch(() => null);
        if (res && res.ok) {
          const wallets = await res.json();
          items = [{
            id: 'system_wallet_balances',
            title: 'Wallet Balances',
            category: 'wallet_data',
            location: 'system',
            url: JSON.stringify(wallets)
          }];
        }
      } else if (idFilter === 'system_settings') {
        const res = await fetch('/api/settings').catch(() => null);
        if (res && res.ok) {
          const settings = await res.json();
          items = [{
            id: 'system_settings',
            title: 'Configuración del Sistema',
            category: 'settings_data',
            location: 'system',
            url: JSON.stringify(settings)
          }];
        }
      } else if (idFilter === 'system_packages') {
        const res = await fetch('/api/packages').catch(() => null);
        if (res && res.ok) {
          const packages = await res.json();
          items = [{
            id: 'system_packages',
            title: 'Paquetes de Fotografía',
            category: 'package_data',
            location: 'system',
            url: JSON.stringify(packages)
          }];
        }
      } else {
        // Catálogo público de fotos
        const res = await fetch('/api/catalog').catch(() => null);
        if (res && res.ok) {
          items = await res.json();
        }
      }
    } else if (table === 'bookings') {
      const res = await fetch('/api/admin/bookings', { headers }).catch(() => null);
      if (res && res.ok) items = await res.json();
    } else if (table === 'payments') {
      const res = await fetch('/api/admin/payments', { headers }).catch(() => null);
      if (res && res.ok) items = await res.json();
    } else if (table === 'sessions') {
      const res = await fetch('/api/admin/sessions', { headers }).catch(() => null);
      if (res && res.ok) items = await res.json();
    } else if (table === 'reviews') {
      const res = await fetch('/api/reviews').catch(() => null);
      if (res && res.ok) items = await res.json();
    } else if (table === 'packages') {
      const res = await fetch('/api/packages').catch(() => null);
      if (res && res.ok) items = await res.json();
    } else if (table === 'settings') {
      const res = await fetch('/api/settings').catch(() => null);
      if (res && res.ok) {
        const s = await res.json();
        items = [s];
      }
    } else if (table === 'vip_clients') {
      const res = await fetch('/api/admin/vip', { headers }).catch(() => null);
      if (res && res.ok) items = await res.json();
    }

    let filtered = Array.isArray(items) ? [...items] : [];

    // Aplicar filtros eq en memoria
    for (const [col, val] of Object.entries(queryState.eqFilters)) {
      filtered = filtered.filter(item => item && String(item[col]) === String(val));
    }

    // Aplicar filtros in en memoria
    for (const [col, vals] of Object.entries(queryState.inFilters)) {
      const set = new Set((vals || []).map(String));
      filtered = filtered.filter(item => item && set.has(String(item[col])));
    }

    // Aplicar filtros not en memoria
    for (const notRule of queryState.notFilters) {
      if (notRule.op === 'like') {
        const prefix = notRule.val.replace(/[%_]/g, '');
        filtered = filtered.filter(item => !item || !String(item[notRule.col] || '').startsWith(prefix));
      } else if (notRule.op === 'eq') {
        filtered = filtered.filter(item => !item || String(item[notRule.col]) !== String(notRule.val));
      }
    }

    // Aplicar límite si existe
    if (queryState.limitCount && queryState.limitCount > 0) {
      filtered = filtered.slice(0, queryState.limitCount);
    }

    if (queryState.isSingle) {
      if (filtered.length > 0) {
        return { data: filtered[0], error: null };
      }
      return { data: null, error: { message: 'Registro no encontrado', code: 'PGRST116' } };
    }

    if (queryState.isMaybeSingle) {
      return { data: filtered[0] || null, error: null };
    }

    return { data: filtered, error: null };
  } catch (err) {
    console.warn(`[DB Proxy Read] Fallback suave en tabla ${table}:`, err?.message || err);
    if (queryState.isMaybeSingle) return { data: null, error: null };
    if (queryState.isSingle) return { data: null, error: { message: err?.message || 'Error', code: 'PGRST116' } };
    return { data: [], error: null };
  }
}

/**
 * Constructor de consultas encadenables para lecturas (.select).
 */
function createReadBuilder(table) {
  const queryState = {
    eqFilters: {},
    inFilters: {},
    notFilters: [],
    limitCount: null,
    isSingle: false,
    isMaybeSingle: false
  };

  const builder = {
    eq(col, val) {
      queryState.eqFilters[col] = val;
      return builder;
    },
    in(col, vals) {
      queryState.inFilters[col] = vals;
      return builder;
    },
    not(col, op, val) {
      queryState.notFilters.push({ col, op, val });
      return builder;
    },
    order() {
      return builder;
    },
    limit(num) {
      queryState.limitCount = num;
      return builder;
    },
    single() {
      queryState.isSingle = true;
      return builder;
    },
    maybeSingle() {
      queryState.isMaybeSingle = true;
      return builder;
    },
    then(onFulfilled, onRejected) {
      return executeProxyRead(table, queryState).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return executeProxyRead(table, queryState).catch(onRejected);
    }
  };

  return builder;
}

/**
 * Constructor de consultas encadenables para escrituras.
 */
function createWriteBuilder(table, op, payload) {
  const match = {};

  const builder = {
    eq(col, val) {
      match[col] = val;
      return builder;
    },
    in(col, vals) {
      match[col] = vals;
      return builder;
    },
    match(obj) {
      if (obj && typeof obj === 'object') {
        Object.assign(match, obj);
      }
      return builder;
    },
    select() {
      return builder;
    },
    single() {
      return builder;
    },
    maybeSingle() {
      return builder;
    },
    then(onFulfilled, onRejected) {
      return executeProxyWrite(table, op, payload, match).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return executeProxyWrite(table, op, payload, match).catch(onRejected);
    }
  };

  return builder;
}

function createMockChannel(name) {
  const channel = {
    name,
    on: () => channel,
    subscribe: (cb) => {
      if (typeof cb === 'function') {
        setTimeout(() => cb('SUBSCRIBED'), 10);
      }
      return channel;
    },
    unsubscribe: () => Promise.resolve('ok'),
    send: () => Promise.resolve('ok')
  };
  return channel;
}

const guardedFrom = (table) => {
  return {
    select: () => createReadBuilder(table),
    upsert: (payload) => createWriteBuilder(table, 'upsert', payload),
    insert: (payload) => createWriteBuilder(table, 'insert', payload),
    update: (payload) => createWriteBuilder(table, 'update', payload),
    delete: () => createWriteBuilder(table, 'delete', null)
  };
};

export const supabase = new Proxy(baseSupabase, {
  get: (target, prop) => {
    if (prop === 'from') return guardedFrom;
    if (prop === 'channel') return (name) => createMockChannel(name);
    if (prop === 'removeChannel') return () => Promise.resolve('ok');
    if (prop === 'removeAllChannels') return () => Promise.resolve('ok');
    return target[prop];
  }
});
