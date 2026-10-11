-- ==============================================================================
-- ETAPA A — CERRAR EL ACCESO ANÓNIMO A DATOS PRIVADOS
-- Sebastian G Fotografía · pegar COMPLETO en Supabase → SQL Editor → Run
-- ==============================================================================
-- Qué hace:
--   1. Borra TODAS las políticas actuales de las 6 tablas (dinámicamente,
--      porque los nombres varían entre versiones del esquema).
--   2. Deja el catálogo público en SOLO LECTURA del portafolio y los testimonios,
--      pero CONSERVA la escritura para que el panel siga subiendo fotos.
--      → Las galerías privadas (fotos de clientes), los pagos, las reservas,
--        los VIP y los secretos dejan de ser legibles con la clave pública.
--   3. Deja reservas, pagos, sesiones y configuración SOLO para el servidor.
--
-- Requisito previo (YA CUMPLIDO): SUPABASE_REST_KEY en Vercel = clave service_role.
--
-- Efectos funcionales esperados (todos con degradación elegante):
--   · Galería del cliente: sigue funcionando (usa la API).
--   · Testimonios: siguen (lectura permitida + API).
--   · Panel: reservas y pagos siguen llegando por la API.
--   · Pestaña VIP: puede aparecer vacía hasta crear su endpoint (Fase 2.2).
--   · Subir fotos al portafolio y demás escrituras del panel: SIGUEN funcionando
--     (se conservan las políticas de escritura hasta la Etapa B).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1) BORRAR TODAS LAS POLÍTICAS ACTUALES DE LAS 6 TABLAS
-- ------------------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('bookings','sessions','payments','catalog','system_config','reviews')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------------------------
-- 2) RLS ACTIVO EN TODAS
-- ------------------------------------------------------------------------------
alter table public.bookings      enable row level security;
alter table public.sessions      enable row level security;
alter table public.payments      enable row level security;
alter table public.catalog       enable row level security;
alter table public.system_config enable row level security;
alter table public.reviews       enable row level security;

-- ------------------------------------------------------------------------------
-- 3) CATÁLOGO — lectura pública SOLO de lo que debe ser público
-- ------------------------------------------------------------------------------
-- Permitido con la clave anónima:
--   · el portafolio (fotos del sitio)
--   · los testimonios (review_data)
--   · los ajustes comerciales (system_settings: precios y textos que la web necesita)
-- Bloqueado:
--   · session_data  -> FOTOS PRIVADAS DE CLIENTES
--   · booking_data  -> reservas con nombre, WhatsApp y correo
--   · payment_data  -> pagos y abonos
--   · vip_client    -> clientes VIP
--   · system_*      -> hash del PIN, retos 2FA, saldos de billeteras
create policy "catalog_public_read" on public.catalog
for select
to anon, authenticated
using (
      id = 'system_settings'
   or category = 'review_data'
   or (
        not starts_with(id, 'system_')
    and not starts_with(id, 'sess-')
    and not starts_with(id, 'book-')
    and not starts_with(id, 'pay-')
    and not starts_with(id, 'rev-')
    and not starts_with(id, 'vip-')
    and right(coalesce(category, ''), 5) <> '_data'
   )
);

-- Escritura del catálogo: se conserva para que el panel siga funcionando.
-- (Se cerrará en la ETAPA B, cuando esas escrituras pasen por la API.)
create policy "catalog_anon_insert" on public.catalog
for insert to anon, authenticated with check (true);

create policy "catalog_anon_update" on public.catalog
for update to anon, authenticated using (true) with check (true);

create policy "catalog_anon_delete" on public.catalog
for delete to anon, authenticated using (true);

-- ------------------------------------------------------------------------------
-- 4) RESEÑAS — lectura pública (testimonios del sitio)
-- ------------------------------------------------------------------------------
create policy "reviews_public_read" on public.reviews
for select to anon, authenticated using (true);

-- ------------------------------------------------------------------------------
-- 5) RESERVAS, PAGOS, SESIONES Y CONFIGURACIÓN — SOLO EL SERVIDOR
-- ------------------------------------------------------------------------------
-- No se crea ninguna política para anon: sin política, RLS deniega.
-- El backend sigue funcionando porque usa service_role, que ignora RLS.
-- Reservas y pagos entran ahora por POST /api/bookings y POST /api/payments.


-- ==============================================================================
-- VERIFICACIÓN — ejecuta esto después y mira los resultados
-- ==============================================================================

-- 6.1 ¿Qué políticas quedaron? Revisa que NO haya ninguna para anon en
--     bookings, sessions, payments ni system_config.
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, cmd;

-- 6.2 Inventario de lo que hay en la tabla pública del catálogo.
--     (Las filas siguen existiendo: la política las OCULTA al público, no las borra.)
select category, count(*) as filas
from public.catalog
group by category
order by filas desc;

-- ==============================================================================
-- PRUEBA FINAL (desde fuera, sin sesión de Supabase)
-- ==============================================================================
-- Con la clave anónima, estas dos consultas deben devolver [] (lista vacía)
-- y NO tus datos:
--
--   curl "https://maqqzcawbdhhfqxoabyq.supabase.co/rest/v1/catalog?select=*&category=eq.session_data&limit=1" ^
--        -H "apikey: <TU_ANON_KEY>"
--
--   curl "https://maqqzcawbdhhfqxoabyq.supabase.co/rest/v1/bookings?select=*&limit=1" ^
--        -H "apikey: <TU_ANON_KEY>"
--
-- Y esto debe seguir devolviendo tus fotos del portafolio:
--
--   curl "https://maqqzcawbdhhfqxoabyq.supabase.co/rest/v1/catalog?select=id,title&limit=3" ^
--        -H "apikey: <TU_ANON_KEY>"


-- ==============================================================================
-- ETAPA B — cuando TODAS las escrituras del navegador pasen por la API
-- ==============================================================================
-- Descomenta y ejecuta SOLO cuando esto devuelva 0 líneas:
--   grep -rn "supabase.from" src/ | grep -E "\.(upsert|insert|update|delete)\("
/*
drop policy if exists "catalog_anon_insert" on public.catalog;
drop policy if exists "catalog_anon_update" on public.catalog;
drop policy if exists "catalog_anon_delete" on public.catalog;

create policy "catalog_service_all" on public.catalog
  for all to service_role using (true) with check (true);

create policy "reviews_service_all" on public.reviews
  for all to service_role using (true) with check (true);
*/
