-- ============================================================================
-- MIGRACIÓN: REPOSITORIO Y MÓDULO INTELIGENTE DE AGENCIAS SHALOM (POSTGIS)
-- ============================================================================

-- 1. Extensiones necesarias para geolocalización y búsqueda fuzzy
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Tabla de Agencias Shalom
CREATE TABLE IF NOT EXISTS shalom_agencies (
    id INT PRIMARY KEY,                       -- ID único del terminal/agencia de Shalom
    code VARCHAR(50),                         -- Abreviatura / Código oficial (e.g. 'BGACHCA')
    name VARCHAR(255) NOT NULL,               -- Nombre de la agencia
    full_name TEXT,                           -- Nombre completo normalizado
    department VARCHAR(100) NOT NULL,         -- Departamento (e.g. 'AMAZONAS', 'LIMA', 'AYACUCHO')
    province VARCHAR(100) NOT NULL,           -- Provincia (e.g. 'HUAMANGA', 'LIMA')
    district VARCHAR(100) NOT NULL,           -- Distrito o zona
    ubigeo VARCHAR(20),                       -- Código de Ubigeo oficial (ubi_id)
    dep_id INT,                               -- ID numérico de Departamento
    prov_id INT,                              -- ID numérico de Provincia
    dist_id INT,                              -- ID numérico de Distrito
    address TEXT NOT NULL,                    -- Dirección detallada y referencias
    phone VARCHAR(50),                        -- Teléfono de contacto
    schedule TEXT,                            -- Horario de atención
    latitude DOUBLE PRECISION,                -- Latitud numérica para acceso rápido
    longitude DOUBLE PRECISION,               -- Longitud numérica para acceso rápido
    location GEOGRAPHY(Point, 4326),          -- Punto espacial GPS PostGIS (SRID 4326)
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Índices de alto rendimiento para consultas espaciales y de texto
CREATE INDEX IF NOT EXISTS idx_shalom_agencies_location ON shalom_agencies USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_shalom_agencies_trgm ON shalom_agencies USING GIN (name gin_trgm_ops, district gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shalom_agencies_dep_prov ON shalom_agencies (department, province, district);
CREATE INDEX IF NOT EXISTS idx_shalom_agencies_ubigeo ON shalom_agencies (ubigeo);

-- 4. Función RPC para búsqueda ultra-rápida de agencias más cercanas por GPS
CREATE OR REPLACE FUNCTION get_nearby_shalom_agencies(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    max_limit INT DEFAULT 1000
)
RETURNS TABLE (
    id INT,
    code VARCHAR(50),
    name VARCHAR(255),
    full_name TEXT,
    department VARCHAR(100),
    province VARCHAR(100),
    district VARCHAR(100),
    ubigeo VARCHAR(20),
    address TEXT,
    phone VARCHAR(50),
    schedule TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        s.id,
        s.code,
        s.name,
        COALESCE(s.full_name, s.name) AS full_name,
        s.department,
        s.province,
        s.district,
        s.ubigeo,
        s.address,
        s.phone,
        s.schedule,
        COALESCE(s.latitude, ST_Y(s.location::geometry)) AS latitude,
        COALESCE(s.longitude, ST_X(s.location::geometry)) AS longitude,
        ST_Distance(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) AS distance_meters
    FROM shalom_agencies s
    WHERE s.is_active = TRUE 
      AND s.location IS NOT NULL
    ORDER BY s.location <-> ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    LIMIT max_limit;
$$;

-- 5. Trigger para autogenerar la columna geográfica (PostGIS location) a partir de lat/lng
CREATE OR REPLACE FUNCTION update_shalom_agency_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_shalom_agency_location ON shalom_agencies;
CREATE TRIGGER trg_update_shalom_agency_location
BEFORE INSERT OR UPDATE ON shalom_agencies
FOR EACH ROW
EXECUTE FUNCTION update_shalom_agency_location();

-- 6. Seguridad de Nivel de Fila (RLS)
ALTER TABLE shalom_agencies ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública a cualquier cliente anónimo o autenticado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shalom_agencies' AND policyname = 'Allow public read access on shalom_agencies'
    ) THEN
        CREATE POLICY "Allow public read access on shalom_agencies" 
        ON shalom_agencies FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shalom_agencies' AND policyname = 'Allow write access for sync operations'
    ) THEN
        CREATE POLICY "Allow write access for sync operations" 
        ON shalom_agencies FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
