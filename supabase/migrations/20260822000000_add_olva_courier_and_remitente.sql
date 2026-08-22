-- ============================================================================
-- MIGRACIÓN: AGENCIA OLVA COURIER Y CAMPOS DE REMITENTE PARA GUÍAS
-- ============================================================================

-- 1. Actualizar check constraint de tipo_formulario en metodos_envio si aplica
DO $$
BEGIN
  ALTER TABLE metodos_envio DROP CONSTRAINT IF EXISTS metodos_envio_tipo_formulario_check;
  ALTER TABLE metodos_envio ADD CONSTRAINT metodos_envio_tipo_formulario_check 
    CHECK (tipo_formulario IN ('shalom', 'mapa_direccion', 'texto_simple', 'olva'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Insertar Olva Courier en metodos_envio por defecto
INSERT INTO metodos_envio (codigo, nombre, descripcion, icono, tipo_formulario, activo, orden)
VALUES (
  'olva',
  'Olva Courier Nacional',
  'Envíos a domicilio y agencias Olva en todo el Perú',
  'Truck',
  'olva',
  true,
  3
)
ON CONFLICT (codigo) DO UPDATE 
SET 
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  tipo_formulario = EXCLUDED.tipo_formulario,
  activo = EXCLUDED.activo;

-- 3. Añadir campos de remitente en taller_config
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'taller_config' AND column_name = 'remitente_email') THEN
    ALTER TABLE taller_config ADD COLUMN remitente_email VARCHAR(255) DEFAULT 'comikidsperu@gmail.com';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'taller_config' AND column_name = 'remitente_dni') THEN
    ALTER TABLE taller_config ADD COLUMN remitente_dni VARCHAR(50) DEFAULT '42020312';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'taller_config' AND column_name = 'remitente_celular') THEN
    ALTER TABLE taller_config ADD COLUMN remitente_celular VARCHAR(50) DEFAULT '927781412';
  END IF;
END $$;
