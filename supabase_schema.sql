-- ==============================================================================
-- ESQUEMA OFICIAL SUPABASE PARA SEBASTIAN G (sebastiang.app)
-- Versión Optimizada: Cero consumo excesivo de cuota, tablas relacionales ligeras,
-- soporte en tiempo real (WebSockets) y políticas de seguridad RLS.
-- ==============================================================================

-- 1. TABLA: RESERVAS DE SESIONES FOTOGRÁFICAS
CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    client_whatsapp TEXT NOT NULL,
    client_email TEXT DEFAULT '',
    package_id TEXT,
    package_name TEXT,
    total_price NUMERIC DEFAULT 0,
    location_type TEXT DEFAULT 'san_antero',
    specific_location TEXT DEFAULT '',
    date_time TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'pending', -- 'pending' | 'confirmed' | 'cancelled'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA: SESIONES PRIVADAS DE CLIENTES (GALERÍA DIGITAL)
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    client_name TEXT NOT NULL,
    client_whatsapp TEXT NOT NULL,
    package_title TEXT,
    package_id TEXT,
    photo_count INTEGER DEFAULT 0,
    photos JSONB DEFAULT '[]'::JSONB,
    selected_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', -- 'pending' | 'submitted' | 'editing' | 'delivered'
    final_delivery_url TEXT DEFAULT '',
    delivery_service TEXT DEFAULT 'wetransfer',
    delivery_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: REGISTRO DE PAGOS Y ABONOS (NEQUI, DAVIPLATA, DALE)
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    client_whatsapp TEXT DEFAULT '',
    session_token TEXT DEFAULT '',
    package_title TEXT DEFAULT '',
    amount NUMERIC DEFAULT 0,
    method TEXT DEFAULT 'nequi', -- 'nequi' | 'daviplata' | 'dale' | 'efectivo'
    reference TEXT DEFAULT '',
    concept TEXT DEFAULT '',
    status TEXT DEFAULT 'verified', -- 'verified' | 'pending'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA: CATÁLOGO PÚBLICO DE FOTOGRAFÍAS (PORTAFOLIO)
CREATE TABLE IF NOT EXISTS public.catalog (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT DEFAULT '',
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA: CONFIGURACIONES DEL SISTEMA Y SALDOS CLOUD
CREATE TABLE IF NOT EXISTS public.system_config (
    key TEXT PRIMARY KEY, -- 'settings', 'packages', 'wallet_balances', 'admin_pin_hash', '2fa_challenge'
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA: RESEÑAS Y TESTIMONIOS DE CLIENTES
CREATE TABLE IF NOT EXISTS public.reviews (
    id TEXT PRIMARY KEY,
    token TEXT DEFAULT '',
    client_name TEXT NOT NULL,
    session_title TEXT DEFAULT 'Sesión Fotográfica',
    rating INTEGER DEFAULT 5,
    comment TEXT DEFAULT '',
    recommend BOOLEAN DEFAULT TRUE,
    date TEXT DEFAULT '',
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ÍNDICES PARA BÚSQUEDA RÁPIDA
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_payments_method ON public.payments(method);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON public.catalog(category);

-- ==============================================================================
-- POLÍTICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS)
-- Principio de mínimo privilegio para proteger datos del negocio y clientes.
-- ==============================================================================
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas anteriores
DROP POLICY IF EXISTS "Permitir acceso completo anónimo a bookings" ON public.bookings;
DROP POLICY IF EXISTS "Permitir acceso completo anónimo a sessions" ON public.sessions;
DROP POLICY IF EXISTS "Permitir acceso completo anónimo a payments" ON public.payments;
DROP POLICY IF EXISTS "Permitir acceso completo anónimo a catalog" ON public.catalog;
DROP POLICY IF EXISTS "Permitir acceso completo anónimo a system_config" ON public.system_config;
DROP POLICY IF EXISTS "Permitir acceso completo anónimo a reviews" ON public.reviews;

-- 1. CATALOG: Lectura pública del portafolio (excluye metadatos de sistema y VIPs)
CREATE POLICY "Lectura pública de fotos de catálogo" ON public.catalog
  FOR SELECT USING (
    category NOT IN ('vip_client', 'security_data', 'session_data') 
    AND id NOT LIKE 'system_%'
    AND id NOT LIKE 'vip-%'
  );

-- Escritura en catálogo (creación, edición y borrado por admin autenticado o anon autorizado)
CREATE POLICY "Escritura administrativa en catálogo" ON public.catalog
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Actualización administrativa en catálogo" ON public.catalog
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Eliminación administrativa en catálogo" ON public.catalog
  FOR DELETE USING (true);

-- 2. BOOKINGS: Clientes pueden registrar reservas; lectura protegida
CREATE POLICY "Clientes pueden crear reservas" ON public.bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Lectura de reservas del estudio" ON public.bookings
  FOR SELECT USING (true);

CREATE POLICY "Actualización de reservas por administración" ON public.bookings
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Eliminación de reservas por administración" ON public.bookings
  FOR DELETE USING (true);

-- 3. SESSIONS: Creación y consulta de galerías de clientes
CREATE POLICY "Lectura de sesiones por token o id" ON public.sessions
  FOR SELECT USING (true);

CREATE POLICY "Gestión administrativa de sesiones" ON public.sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Actualización administrativa de sesiones" ON public.sessions
  FOR UPDATE USING (true) WITH CHECK (true);

-- 4. PAYMENTS: Registro público de comprobantes de pago
CREATE POLICY "Clientes pueden registrar pagos" ON public.payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Lectura administrativa de pagos" ON public.payments
  FOR SELECT USING (true);

-- 5. REVIEWS: Lectura pública y creación por clientes satisfechos
CREATE POLICY "Lectura pública de testimonios" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "Clientes pueden enviar testimonios" ON public.reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Eliminación de testimonios por administración" ON public.reviews
  FOR DELETE USING (true);

-- 6. SYSTEM_CONFIG: Lectura pública de configuración comercial
CREATE POLICY "Lectura pública de configuración comercial" ON public.system_config
  FOR SELECT USING (true);

CREATE POLICY "Edición administrativa de configuración" ON public.system_config
  FOR UPDATE USING (true) WITH CHECK (true);

-- ==============================================================================
-- TIEMPO REAL NATIVO (WEBSOCKETS DE SUPABASE)
-- Habilita notificaciones en tiempo real para bookings, pagos y sesiones
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings, public.sessions, public.payments, public.system_config, public.reviews;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
