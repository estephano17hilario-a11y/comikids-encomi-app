-- ============================================================================
-- MIGRACIÓN: REPOSITORIO Y MÓDULO INTELIGENTE DE AGENCIAS OLVA COURIER (POSTGIS)
-- ============================================================================

-- 1. Extensiones necesarias para geolocalización y búsqueda fuzzy
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Tabla de Agencias Olva Courier
CREATE TABLE IF NOT EXISTS olva_agencies (
    id INT PRIMARY KEY,                       -- ID secuencial de la agencia Olva
    code VARCHAR(50),                         -- Código de agencia / ubigeo
    name VARCHAR(255) NOT NULL,               -- Nombre de la agencia
    full_name TEXT,                           -- Nombre completo normalizado
    department VARCHAR(100) NOT NULL,         -- Departamento
    province VARCHAR(100) NOT NULL,           -- Provincia
    district VARCHAR(100) NOT NULL,           -- Distrito o zona
    ubigeo VARCHAR(20),                       -- Código de Ubigeo oficial INEI / RENIEC
    address TEXT NOT NULL,                    -- Dirección detallada
    phone VARCHAR(50),                        -- Teléfono
    schedule TEXT,                            -- Horario de atención
    tipo VARCHAR(50),                         -- TIENDAS | OLVA-AGENTES | PUNTOS-AUTORIZADOS
    is_partner BOOLEAN DEFAULT FALSE,         -- Si es agente partner
    latitude DOUBLE PRECISION,                -- Latitud GPS
    longitude DOUBLE PRECISION,               -- Longitud GPS
    location GEOGRAPHY(Point, 4326),          -- Punto espacial PostGIS (SRID 4326)
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_olva_agencies_location ON olva_agencies USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_olva_agencies_trgm ON olva_agencies USING GIN (name gin_trgm_ops, district gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_olva_agencies_dep_prov ON olva_agencies (department, province, district);
CREATE INDEX IF NOT EXISTS idx_olva_agencies_ubigeo ON olva_agencies (ubigeo);

-- 4. Función RPC para búsqueda de agencias Olva más cercanas por GPS
CREATE OR REPLACE FUNCTION get_nearby_olva_agencies(
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
    tipo VARCHAR(50),
    is_partner BOOLEAN,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        o.id,
        o.code,
        o.name,
        COALESCE(o.full_name, o.name) AS full_name,
        o.department,
        o.province,
        o.district,
        o.ubigeo,
        o.address,
        o.phone,
        o.schedule,
        o.tipo,
        o.is_partner,
        COALESCE(o.latitude, ST_Y(o.location::geometry)) AS latitude,
        COALESCE(o.longitude, ST_X(o.location::geometry)) AS longitude,
        ST_Distance(o.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) AS distance_meters
    FROM olva_agencies o
    WHERE o.is_active = TRUE 
      AND o.location IS NOT NULL
    ORDER BY o.location <-> ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    LIMIT max_limit;
$$;

-- 5. Trigger para autogenerar la columna geográfica (PostGIS location) a partir de lat/lng
CREATE OR REPLACE FUNCTION update_olva_agency_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_olva_agency_location ON olva_agencies;
CREATE TRIGGER trg_update_olva_agency_location
BEFORE INSERT OR UPDATE ON olva_agencies
FOR EACH ROW
EXECUTE FUNCTION update_olva_agency_location();

-- 6. Seguridad de Nivel de Fila (RLS)
ALTER TABLE olva_agencies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'olva_agencies' AND policyname = 'Allow public read access on olva_agencies'
    ) THEN
        CREATE POLICY "Allow public read access on olva_agencies" 
        ON olva_agencies FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'olva_agencies' AND policyname = 'Allow write access for sync operations'
    ) THEN
        CREATE POLICY "Allow write access for sync operations" 
        ON olva_agencies FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
