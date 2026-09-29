-- =========================================================================
-- ESQUEMA DE BASE DE DATOS POSTGRESQL PARA SEBASTIAN G FOTOGRAFÍA
-- Diseñado para máxima velocidad, persistencia indestructible y 0 cuota excedida.
-- =========================================================================

-- 1. TABLA DE RESERVAS DE CLIENTES
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_whatsapp TEXT NOT NULL,
  client_email TEXT DEFAULT '',
  package_id TEXT DEFAULT 'pkg-4fotos',
  package_name TEXT DEFAULT '4 Fotos Digitales',
  total_price NUMERIC DEFAULT 45000,
  location_type TEXT DEFAULT 'san_antero',
  specific_location TEXT DEFAULT 'San Antero',
  date_time TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA DE CATÁLOGO Y PORTAFOLIO PÚBLICO
CREATE TABLE IF NOT EXISTS catalog (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'Portafolio',
  location TEXT DEFAULT 'San Antero',
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA DE GALERÍAS PRIVADAS DE CLIENTES
CREATE TABLE IF NOT EXISTS client_sessions (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_whatsapp TEXT DEFAULT '',
  package_name TEXT DEFAULT 'Sesión Fotográfica',
  token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  photos JSONB DEFAULT '[]'::jsonb,
  selected_photos JSONB DEFAULT '[]'::jsonb,
  extra_photos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE TESTIMONIOS Y RESEÑAS
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  comment TEXT NOT NULL,
  verified BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA DE PAGOS Y SALDOS (NEQUI, DAVIPLATA, DALE)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_whatsapp TEXT DEFAULT '',
  session_token TEXT DEFAULT '',
  package_title TEXT DEFAULT '',
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL,
  reference TEXT DEFAULT '',
  concept TEXT DEFAULT '',
  status TEXT DEFAULT 'verified',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA DE CONFIGURACIONES DEL SISTEMA
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- POLÍTICAS DE ACCESO PÚBLICO SEGURO (ROW LEVEL SECURITY)
-- Permite lectura y escritura inmediata desde la web y la APK móvil
-- =========================================================================

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública
DROP POLICY IF EXISTS "Permitir lectura bookings" ON bookings;
CREATE POLICY "Permitir lectura bookings" ON bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion bookings" ON bookings;
CREATE POLICY "Permitir insercion bookings" ON bookings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion bookings" ON bookings;
CREATE POLICY "Permitir actualizacion bookings" ON bookings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion bookings" ON bookings;
CREATE POLICY "Permitir eliminacion bookings" ON bookings FOR DELETE USING (true);

-- Catálogo
DROP POLICY IF EXISTS "Permitir lectura catalog" ON catalog;
CREATE POLICY "Permitir lectura catalog" ON catalog FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir modificacion catalog" ON catalog;
CREATE POLICY "Permitir modificacion catalog" ON catalog FOR ALL USING (true);

-- Sesiones de clientes
DROP POLICY IF EXISTS "Permitir lectura sessions" ON client_sessions;
CREATE POLICY "Permitir lectura sessions" ON client_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir modificacion sessions" ON client_sessions;
CREATE POLICY "Permitir modificacion sessions" ON client_sessions FOR ALL USING (true);

-- Reseñas
DROP POLICY IF EXISTS "Permitir lectura reviews" ON reviews;
CREATE POLICY "Permitir lectura reviews" ON reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir modificacion reviews" ON reviews;
CREATE POLICY "Permitir modificacion reviews" ON reviews FOR ALL USING (true);

-- Pagos
DROP POLICY IF EXISTS "Permitir lectura payments" ON payments;
CREATE POLICY "Permitir lectura payments" ON payments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir modificacion payments" ON payments;
CREATE POLICY "Permitir modificacion payments" ON payments FOR ALL USING (true);

-- Configuraciones
DROP POLICY IF EXISTS "Permitir lectura settings" ON settings;
CREATE POLICY "Permitir lectura settings" ON settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir modificacion settings" ON settings;
CREATE POLICY "Permitir modificacion settings" ON settings FOR ALL USING (true);
