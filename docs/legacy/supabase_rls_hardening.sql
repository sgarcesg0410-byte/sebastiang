-- ==============================================================================
-- ⚠️ ARCHIVO HISTÓRICO DEPRECADO — NO EJECUTAR EN PRODUCCIÓN
-- ==============================================================================
-- CIERRE DEFINITIVO DE SUPABASE / RLS (ETAPA A + ETAPA B COMPLETAS)
-- Sebastian G Fotografía · MongoDB Atlas es ahora la única fuente de verdad (Single Source of Truth)
-- Pegar COMPLETO en Supabase → SQL Editor → Run (si el proyecto Supabase sigue existiendo)
-- ==============================================================================

-- 1) ELIMINAR TODAS LAS POLÍTICAS ACTUALES DE LAS TABLAS PÚBLICAS
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

-- 2) FORZAR ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS
alter table if exists public.bookings      enable row level security;
alter table if exists public.sessions      enable row level security;
alter table if exists public.payments      enable row level security;
alter table if exists public.catalog       enable row level security;
alter table if exists public.system_config enable row level security;
alter table if exists public.reviews       enable row level security;

alter table if exists public.bookings      force row level security;
alter table if exists public.sessions      force row level security;
alter table if exists public.payments      force row level security;
alter table if exists public.catalog       force row level security;
alter table if exists public.system_config force row level security;
alter table if exists public.reviews       force row level security;

-- 3) REVOCAR PRIVILEGIOS DIRECTOS DE ROLES ANON Y AUTHENTICATED
revoke all on table public.bookings      from anon, authenticated;
revoke all on table public.sessions      from anon, authenticated;
revoke all on table public.payments      from anon, authenticated;
revoke all on table public.catalog       from anon, authenticated;
revoke all on table public.system_config from anon, authenticated;
revoke all on table public.reviews       from anon, authenticated;

-- 4) PERMITIR ÚNICAMENTE A SERVICE_ROLE (ADMINISTRACIÓN INTERNA / BACKUP)
create policy "bookings_service_only" on public.bookings
  for all to service_role using (true) with check (true);

create policy "sessions_service_only" on public.sessions
  for all to service_role using (true) with check (true);

create policy "payments_service_only" on public.payments
  for all to service_role using (true) with check (true);

create policy "catalog_service_only" on public.catalog
  for all to service_role using (true) with check (true);

create policy "system_config_service_only" on public.system_config
  for all to service_role using (true) with check (true);

create policy "reviews_service_only" on public.reviews
  for all to service_role using (true) with check (true);

-- ==============================================================================
-- 5) CONSULTA DE VERIFICACIÓN OFICIAL (EJECUTAR Y COMPROBAR QUE SOLO EXISTA service_role)
-- ==============================================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
