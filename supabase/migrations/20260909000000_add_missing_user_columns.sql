-- ============================================================================
-- MIGRACIÓN: AGREGAR COLUMNAS FALTANTES A USUARIOS Y OPTIMIZAR PEDIDOS
-- ============================================================================

-- 1. Agregar columnas a usuarios si no existen
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS genero TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS motivo_compra TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tiktok_usuario TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS datos_adicionales_completados BOOLEAN DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_default TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS olva_modalidad_default TEXT;

-- 2. Asegurar que el rol admita 'client', 'empresa' y 'matrix'
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol::text = ANY (ARRAY['client'::text, 'empresa'::text, 'matrix'::text]));

-- 3. Agregar soporte para campos_personalizados en pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS campos_personalizados JSONB DEFAULT '{}'::jsonb;

-- 4. Eliminar restricción de clave foránea estricta de metodo_envio_codigo en pedidos
-- para permitir agencias dinámicas y personalizadas sin errores de integridad
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_metodo_envio_codigo_fkey;

-- 5. Índices para agilizar consultas de clientas y pedidos
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario_id ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON pedidos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usuarios_telefono ON usuarios(telefono_default);

-- 6. Hacer que password_hash y avatar_url tengan valores por defecto seguros
ALTER TABLE usuarios ALTER COLUMN password_hash SET DEFAULT 'incomi2026';
ALTER TABLE usuarios ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE usuarios ALTER COLUMN avatar_url SET DEFAULT '';
ALTER TABLE usuarios ALTER COLUMN avatar_url DROP NOT NULL;

-- 7. Recargar la caché de esquemas de PostgREST
NOTIFY pgrst, 'reload schema';

