-- ============================================================================
-- MIGRACIÓN: Agregar campo de clave de recojo Shalom a pedidos
-- ============================================================================

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS shalom_clave_recojo TEXT;

COMMENT ON COLUMN pedidos.shalom_clave_recojo IS 'Clave o PIN de recojo asignado y registrado para este paquete en Shalom Pro';
