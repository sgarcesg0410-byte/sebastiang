// ==============================================================================
// CLIENTE SUPABASE CON ENVOLTORIO DE SEGURIDAD (PROXY ARCHITECTURE)
// ==============================================================================
// Las lecturas públicas (portafolio, reseñas, ajustes) van directo a Supabase.
// TODAS las escrituras y eliminaciones (catalog, bookings, payments, etc.)
// se canalizan automáticamente a través del endpoint seguro /api/admin/db,
// el cual autentica con el servidor y escribe usando la clave service_role.
// Esto permite activar la Etapa B de RLS sin romper ninguna llamada existente.
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

// Lectura segura desde variables de entorno de Vite con fallback
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL
  || 'https://maqqzcawbdhhfqxoabyq.supabase.co';

const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hcXF6Y2F3YmRoaGZxeG9hYnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDUzNzksImV4cCI6MjEwNjIyMTM3OX0.o35exqFEzfbL58avn8KuVtGkN2uo61ZYh_nmziT1IUY';

export { SUPABASE_URL, SUPABASE_KEY };

// Instancia base de Supabase para lecturas públicas y auth
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
 * /api/admin/db con la sesión firmada de administrador.
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
      console.warn(`[Proxy Supabase] ${errMsg}`, json);
      return { data: null, error: { message: errMsg, status: res.status, detail: json?.detail } };
    }

    return { data: json.data || null, error: null };
  } catch (err) {
    console.error(`[Proxy Supabase] Error de red en ${op} sobre ${table}:`, err);
    return { data: null, error: { message: err?.message || 'Error de red en operación de base de datos' } };
  }
}

/**
 * Constructor de consultas encadenables para escrituras.
 * Soporta .eq(), .in(), .match(), .select(), .single(), .maybeSingle(),
 * y se puede usar directamente con `await`.
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

/**
 * Envoltorio inteligente:
 * - .select(...): Lee del cliente nativo de Supabase.
 * - .upsert / .insert / .update / .delete: Canaliza por /api/admin/db con service_role.
 */
const guardedFrom = (table) => {
  const real = baseSupabase.from(table);
  return {
    select: (...args) => real.select(...args),
    upsert: (payload) => createWriteBuilder(table, 'upsert', payload),
    insert: (payload) => createWriteBuilder(table, 'insert', payload),
    update: (payload) => createWriteBuilder(table, 'update', payload),
    delete: () => createWriteBuilder(table, 'delete', null)
  };
};

export const supabase = new Proxy(baseSupabase, {
  get: (target, prop) => {
    if (prop === 'from') return guardedFrom;
    return target[prop];
  }
});
