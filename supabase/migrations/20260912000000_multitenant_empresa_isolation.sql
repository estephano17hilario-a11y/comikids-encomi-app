-- ============================================================================
-- MIGRACIÓN MULTITENANCY: AISLAMIENTO DE PEDIDOS Y CONFIGURACIÓN POR EMPRESA
-- ============================================================================

-- 1. Agregar empresa_id a la tabla pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS empresa_id VARCHAR(100) DEFAULT 'empresa-master-comikids';

-- 2. Asegurar que los pedidos históricos queden asignados a ComiKids
UPDATE pedidos SET empresa_id = 'empresa-master-comikids' WHERE empresa_id IS NULL OR empresa_id = '';

-- 3. Crear índice para optimizar búsquedas por empresa
CREATE INDEX IF NOT EXISTS idx_pedidos_empresa_id ON pedidos (empresa_id);

-- 4. Agregar empresa_id a la tabla taller_config
ALTER TABLE taller_config ADD COLUMN IF NOT EXISTS empresa_id VARCHAR(100) DEFAULT 'empresa-master-comikids';

-- 5. Asegurar que la configuración inicial principal esté asignada a ComiKids
UPDATE taller_config SET empresa_id = 'empresa-master-comikids' WHERE id = 'config-main' OR empresa_id IS NULL;
