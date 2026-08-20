-- ============================================================================
-- MIGRACIÓN: Agregar campos de Shalom OSE ID y Número de Guía a pedidos
-- ============================================================================

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS shalom_ose_id TEXT,
  ADD COLUMN IF NOT EXISTS shalom_numero_guia TEXT;

-- Índice para búsquedas por guía de Shalom
CREATE INDEX IF NOT EXISTS idx_pedidos_shalom_ose ON pedidos(shalom_ose_id) WHERE shalom_ose_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_shalom_guia ON pedidos(shalom_numero_guia) WHERE shalom_numero_guia IS NOT NULL;

COMMENT ON COLUMN pedidos.shalom_ose_id IS 'ID de la OSE (Orden de Servicio Electrónica) asignado por Shalom API al registrar el pedido';
COMMENT ON COLUMN pedidos.shalom_numero_guia IS 'Número de guía oficial de remisión asignado por Shalom al registrar el envío';
