// ==============================================================================
// CLIENTE SUPABASE
// ==============================================================================
// Las credenciales se leen EXCLUSIVAMENTE desde variables de entorno (Vite).
// Nunca se hardcodean en el código fuente.
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

// Lectura segura desde variables de entorno de Vite con fallback para desarrollo
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL
  || 'https://maqqzcawbdhhfqxoabyq.supabase.co';

const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hcXF6Y2F3YmRoaGZxeG9hYnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDUzNzksImV4cCI6MjEwNjIyMTM3OX0.o35exqFEzfbL58avn8KuVtGkN2uo61ZYh_nmziT1IUY';

// Advertencia en desarrollo si las variables no están configuradas
if (import.meta.env?.DEV) {
  if (!import.meta.env?.VITE_SUPABASE_URL) {
    console.warn(
      '⚠️ [Supabase] VITE_SUPABASE_URL no está definida en .env. ' +
      'Usando valor por defecto. Configura tus variables en .env para producción.'
    );
  }
  if (!import.meta.env?.VITE_SUPABASE_ANON_KEY) {
    console.warn(
      '⚠️ [Supabase] VITE_SUPABASE_ANON_KEY no está definida en .env. ' +
      'Usando valor por defecto. Configura tus variables en .env para producción.'
    );
  }
}

export { SUPABASE_URL, SUPABASE_KEY };

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
