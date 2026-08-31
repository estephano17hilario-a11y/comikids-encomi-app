-- MIGRACIÓN: PERMITIR ESTADO 'listo_para_recojo' EN TABLA PEDIDOS
-- FECHA: 2026-08-31

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_envio_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_envio_check 
  CHECK (estado_envio IN ('pendiente', 'en_camino', 'listo_para_recojo', 'entregado'));

COMMENT ON CONSTRAINT pedidos_estado_envio_check ON pedidos IS 
  'Permite los estados: pendiente, en_camino, listo_para_recojo (arribado a agencia Shalom/Olva) y entregado';
