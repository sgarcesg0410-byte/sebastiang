-- ==============================================================================
-- ENDURECIMIENTO DE RLS EN SUPABASE — Sebastian G
-- ==============================================================================
-- La "RLS de Fase 1" NO cierra nada: dejó SELECT/UPDATE/DELETE USING (true) en
-- bookings, payments, sessions y system_config, y INSERT/UPDATE/DELETE con
-- WITH CHECK (true) en catalog. Es decir: cualquier anónimo con la clave pública
-- (que viaja en el navegador) puede leer reservas, pagos y sesiones, y borrar o
-- reescribir el catálogo y los pagos.
--
-- ⚠️ ORDEN OBLIGATORIO — no ejecutes la ETAPA A sin cumplir el paso 0.
--
-- PASO 0 (imprescindible, si no el backend se queda sin acceso):
--   En Vercel y en el .env local, poner SUPABASE_REST_KEY = la clave
--   **service_role** del proyecto (Project Settings → API), NO la anon key.
--   Comprobación rápida: la clave debe decodificar a "role":"service_role".
--   El backend de /api/index.js usa esa clave y por eso puede saltarse RLS.
--   El frontend sigue usando la anon key (VITE_SUPABASE_ANON_KEY).
--
-- ETAPA A (segura hoy: solo quita LECTURAS que filtran datos personales)
--   El frontend no lee estas tablas directamente: lo hace a través de la API,
--   que ahora usa service_role. Sí puede seguir ESCRIBIENDO (ver ETAPA B).
--
-- ETAPA B (solo después de repuntar las ~36 escrituras directas del navegador)
--   Hoy el navegador escribe directo en Supabase (catalog, bookings, payments...).
--   Mientras eso siga así, hay que mantener esas políticas de escritura o el
--   panel deja de guardar. Cuando esas escrituras pasen por la API, ejecuta la
--   ETAPA B: elimina TODA política de escritura para anon y deja que solo
--   service_role escriba (service_role ignora RLS por diseño).
-- ==============================================================================


-- ##############################################################################
-- ETAPA A — APLICAR AHORA
-- ##############################################################################

-- Lecturas que exponían datos personales a cualquiera
DROP POLICY IF EXISTS "Lectura de reservas del estudio"          ON public.bookings;
DROP POLICY IF EXISTS "Lectura administrativa de pagos"          ON public.payments;
DROP POLICY IF EXISTS "Lectura de sesiones por token o id"       ON public.sessions;
DROP POLICY IF EXISTS "Lectura pública de configuración comercial" ON public.system_config;

-- Se recrean permitiendo SOLO el rol de servicio (el backend).
-- `TO service_role` deja fuera a anon y a authenticated.
CREATE POLICY "bookings_service_only" ON public.bookings
  FOR SELECT TO service_role USING (true);

CREATE POLICY "payments_service_only" ON public.payments
  FOR SELECT TO service_role USING (true);

CREATE POLICY "sessions_service_only" ON public.sessions
  FOR SELECT TO service_role USING (true);

CREATE POLICY "system_config_service_only" ON public.system_config
  FOR SELECT TO service_role USING (true);

-- Comprobación 1: con la ANON key estas consultas deben devolver [] (no datos).
--   curl "https://maqqzcawbdhhfqxoabyq.supabase.co/rest/v1/bookings?select=*&limit=1" ^
--        -H "apikey: <ANON_KEY>"
--   curl "https://maqqzcawbdhhfqxoabyq.supabase.co/rest/v1/payments?select=*&limit=1" ^
--        -H "apikey: <ANON_KEY>"
--   curl "https://maqqzcawbdhhfqxoabyq.supabase.co/rest/v1/system_config?select=*&limit=1" ^
--        -H "apikey: <ANON_KEY>"
--
-- Comprobación 2: el panel sigue funcionando (reservas, pagos y sesiones visibles).
-- Si el panel muestra 0 reservas, el paso 0 está mal: SUPABASE_REST_KEY sigue
-- siendo la anon key. Corrígelo antes de continuar.


-- ##############################################################################
-- ETAPA B — SOLO CUANDO LAS ESCRITURAS DEL NAVEGADOR PASEN POR LA API
-- ##############################################################################
-- Antes de ejecutarla, comprueba que en src/ no queda ninguna escritura directa:
--   grep -rn "supabase.from" src/ | grep -E "\.(upsert|insert|update|delete)\("
-- Debe devolver 0 líneas (o solo lecturas). Entonces:

/*
-- Catálogo: lectura pública del portafolio, escritura solo del servidor
DROP POLICY IF EXISTS "Escritura administrativa en catálogo"     ON public.catalog;
DROP POLICY IF EXISTS "Actualización administrativa en catálogo" ON public.catalog;
DROP POLICY IF EXISTS "Eliminación administrativa en catálogo"   ON public.catalog;

CREATE POLICY "catalog_write_service_only" ON public.catalog
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Reservas: el cliente ya no inserta directo (lo hace POST /api/bookings)
DROP POLICY IF EXISTS "Clientes pueden crear reservas"                   ON public.bookings;
DROP POLICY IF EXISTS "Actualización de reservas por administración"     ON public.bookings;
DROP POLICY IF EXISTS "Eliminación de reservas por administración"       ON public.bookings;

CREATE POLICY "bookings_write_service_only" ON public.bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Sesiones y pagos: idem
DROP POLICY IF EXISTS "Gestión administrativa de sesiones"          ON public.sessions;
DROP POLICY IF EXISTS "Actualización administrativa de sesiones"    ON public.sessions;
DROP POLICY IF EXISTS "Clientes pueden registrar pagos"             ON public.payments;

CREATE POLICY "sessions_write_service_only" ON public.sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "payments_write_service_only" ON public.payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Reseñas: lectura pública, escritura y moderación solo del servidor
DROP POLICY IF EXISTS "Clientes pueden enviar testimonios"               ON public.reviews;
DROP POLICY IF EXISTS "Eliminación de testimonios por administración"    ON public.reviews;

CREATE POLICY "reviews_write_service_only" ON public.reviews
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- system_config: nada de escritura anónima
DROP POLICY IF EXISTS "Edición administrativa de configuración" ON public.system_config;

CREATE POLICY "system_config_write_service_only" ON public.system_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);
*/


-- ##############################################################################
-- AUDITORÍA — ejecuta esto para ver el estado real en cualquier momento
-- ##############################################################################
-- Debe mostrar, para cada tabla, políticas solo para {service_role} o lecturas
-- públicas acotadas. Si ves `anon` con cmd = ALL / INSERT / UPDATE / DELETE en
-- bookings, payments, sessions o system_config, la ETAPA A no se aplicó.

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- ¿Queda algún secreto dentro de la tabla pública del catálogo?
SELECT id, category, left(url, 40) AS url_inicio
FROM public.catalog
WHERE id LIKE 'system_%'
   OR category IN ('security_data', 'session_data', 'payment_data', 'vip_client')
ORDER BY category, id;
