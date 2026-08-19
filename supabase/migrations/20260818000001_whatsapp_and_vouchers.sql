-- ============================================================================
-- MIGRACIÓN: MÓDULO DE COMPROBANTES DE PAGO Y AUDITORÍA DE WHATSAPP
-- ============================================================================

-- 1. Tabla de Comprobantes de Pago (OCR con Gemini 2.0 Flash)
CREATE TABLE IF NOT EXISTS comprobantes_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id TEXT REFERENCES pedidos(id) ON DELETE SET NULL,
    usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    whatsapp_sender VARCHAR(50) NOT NULL,
    numero_operacion VARCHAR(100),
    monto NUMERIC(10, 2),
    moneda VARCHAR(10) DEFAULT 'PEN',
    banco_emisor VARCHAR(100),              -- Yape, Plin, BCP, BBVA, Interbank, Scotiabank, Banco de la Nacion
    titular_origen VARCHAR(255),
    titular_destino VARCHAR(255),
    fecha_pago TIMESTAMP WITH TIME ZONE,
    imagen_url TEXT,
    es_valido BOOLEAN DEFAULT FALSE,
    nivel_confianza VARCHAR(20) DEFAULT 'ALTA' CHECK (nivel_confianza IN ('ALTA', 'MEDIA', 'BAJA', 'MANUAL')),
    motivo_rechazo TEXT,
    gemini_raw_response JSONB,
    estado_verificacion VARCHAR(30) DEFAULT 'procesado_ia' CHECK (estado_verificacion IN ('procesado_ia', 'aprobado_manual', 'rechazado', 'duplicado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de búsqueda para comprobantes
CREATE INDEX IF NOT EXISTS idx_comprobantes_num_op ON comprobantes_pago(numero_operacion);
CREATE INDEX IF NOT EXISTS idx_comprobantes_sender ON comprobantes_pago(whatsapp_sender);
CREATE INDEX IF NOT EXISTS idx_comprobantes_pedido ON comprobantes_pago(pedido_id);

-- 2. Tabla de Auditoría y Logs de Mensajes de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_mensajes_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(100) UNIQUE NOT NULL,
    remote_jid VARCHAR(100) NOT NULL,
    push_name VARCHAR(255),
    tipo_mensaje VARCHAR(50) NOT NULL,      -- conversation, imageMessage, extendedTextMessage, etc.
    contenido_texto TEXT,
    media_url TEXT,
    tipo_procesamiento VARCHAR(50),         -- ocr_comprobante, consulta_logistica, conversacion_general
    respuesta_enviada TEXT,
    duracion_proceso_ms INT,
    estado VARCHAR(30) DEFAULT 'completado' CHECK (estado IN ('en_cola', 'procesando', 'completado', 'error', 'duplicado_ignorado')),
    error_detalle TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_log_jid ON whatsapp_mensajes_log(remote_jid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_log_created ON whatsapp_mensajes_log(created_at DESC);

-- 3. Habilitar Realtime para comprobantes de pago
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE comprobantes_pago;
  EXCEPTION WHEN duplicate_object THEN
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_mensajes_log;
  EXCEPTION WHEN duplicate_object THEN
  END;
END $$;
