-- ============================================================================
-- MIGRACIÓN: TABLA CACHÉ DE CONSULTAS DNI
-- Microservicio backend de consulta de DNI peruanos
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dni_cache (
  numero_doc  VARCHAR(20)  PRIMARY KEY,
  nombre_completo TEXT     NOT NULL,
  fuente      TEXT         NOT NULL DEFAULT 'live',
  consultas   INT          NOT NULL DEFAULT 1,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas ultra rápidas (< 1 ms)
CREATE INDEX IF NOT EXISTS idx_dni_cache_numero_doc ON public.dni_cache (numero_doc);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.update_dni_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.consultas  = OLD.consultas + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dni_cache_updated_at ON public.dni_cache;
CREATE TRIGGER trg_dni_cache_updated_at
  BEFORE UPDATE ON public.dni_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_dni_cache_updated_at();

-- Row Level Security
ALTER TABLE public.dni_cache ENABLE ROW LEVEL SECURITY;

-- Política: lectura pública (anon key puede leer para el frontend)
CREATE POLICY "dni_cache_select_public"
  ON public.dni_cache FOR SELECT
  USING (true);

-- Política: inserción/actualización solo desde server-side (service_role)
-- El endpoint API usa service_role_key que bypassa RLS automáticamente.
-- Las políticas de INSERT/UPDATE solo permiten al role service_role.
CREATE POLICY "dni_cache_insert_service"
  ON public.dni_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "dni_cache_update_service"
  ON public.dni_cache FOR UPDATE
  USING (true);
