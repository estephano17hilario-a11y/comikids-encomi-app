-- ============================================================================
-- PROYECTO INCOMI: ESQUEMA DE BASE DE DATOS SUPABASE ACTUALIZADO (POSTGRESQL)
-- ============================================================================

-- 1. Tabla de Usuarios (Clientas y Cuenta Empresa)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dni VARCHAR(50) UNIQUE NOT NULL,
  nombre_completo VARCHAR(255) NOT NULL,
  edad INT DEFAULT 20,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) DEFAULT 'client' CHECK (rol IN ('client', 'empresa')),
  avatar_url TEXT NOT NULL,
  puntos_xp INT DEFAULT 0,
  nivel INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Métodos de Envío / Destinos (Configurables por la Empresa)
CREATE TABLE IF NOT EXISTS metodos_envio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  icono VARCHAR(50) DEFAULT 'Package',
  tipo_formulario VARCHAR(30) DEFAULT 'texto_simple' CHECK (tipo_formulario IN ('shalom', 'mapa_direccion', 'texto_simple')),
  activo BOOLEAN DEFAULT TRUE,
  orden INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Pedidos (Sin Precios ni Prendas Rígidas)
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_seguimiento VARCHAR(20) UNIQUE NOT NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  detalles_bordado TEXT NOT NULL,
  foto_referencia_url TEXT,
  metodo_envio_codigo VARCHAR(50) REFERENCES metodos_envio(codigo) ON DELETE SET NULL,
  metodo_envio_nombre VARCHAR(255) NOT NULL,
  destino_detalle TEXT NOT NULL,
  latitud DOUBLE PRECISION,
  longitud DOUBLE PRECISION,
  estado_produccion VARCHAR(30) DEFAULT 'en_cola' CHECK (estado_produccion IN ('en_cola', 'bordando', 'completado')),
  estado_envio VARCHAR(30) DEFAULT 'pendiente' CHECK (estado_envio IN ('pendiente', 'en_camino', 'entregado')),
  observaciones_cliente TEXT,
  fecha_limite DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de Logros (Gamificación)
CREATE TABLE IF NOT EXISTS logros_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_logro VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  icono VARCHAR(50) DEFAULT 'award',
  puntos_xp_ganados INT DEFAULT 50,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_usuario_logro UNIQUE (usuario_id, codigo_logro)
);

-- 5. Configuración del Taller
CREATE TABLE IF NOT EXISTS taller_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_taller VARCHAR(255) DEFAULT 'Comikids - Taller de Bordados & Estilo',
  ruc_dni VARCHAR(50) DEFAULT '42020312COMIKIDS',
  celular_taller VARCHAR(20) DEFAULT '+51987654321',
  whatsapp_pedidos VARCHAR(20) DEFAULT '51987654321',
  direccion_taller TEXT DEFAULT 'Av. Gamarra 1234, Taller 402, La Victoria, Lima',
  ciudad_origen VARCHAR(100) DEFAULT 'Lima, Perú'
);

-- Inserción de cuenta maestra de empresa Comikids
INSERT INTO usuarios (id, dni, nombre_completo, edad, password_hash, rol, avatar_url, puntos_xp, nivel)
VALUES (
  'empresa-master-comikids',
  '42020312COMIKIDS',
  'Comikids Bordados & Estilo',
  30,
  '989834969MI',
  'empresa',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  5000,
  10
)
ON CONFLICT (dni) DO NOTHING;

-- Inserción de métodos de envío por defecto
INSERT INTO metodos_envio (codigo, nombre, descripcion, icono, tipo_formulario, activo, orden)
VALUES
  ('shalom', 'Agencia Shalom Nacional', 'Envíos rápidos a agencias oficiales de todo el Perú', 'Package', 'shalom', true, 1),
  ('motorizado', 'Motorizado Local Lima', 'Entrega directa a tu domicilio o trabajo con geolocalización', 'Truck', 'mapa_direccion', true, 2)
ON CONFLICT (codigo) DO NOTHING;

-- Habilitar Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
  EXCEPTION WHEN duplicate_object THEN
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;
  EXCEPTION WHEN duplicate_object THEN
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE metodos_envio;
  EXCEPTION WHEN duplicate_object THEN
  END;
END $$;
