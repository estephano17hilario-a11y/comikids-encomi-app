-- Migration: Agregar campos de configuración de Sub-QR y Copilot a taller_config
ALTER TABLE taller_config ADD COLUMN IF NOT EXISTS copilot_password TEXT DEFAULT '989834969MI';
ALTER TABLE taller_config ADD COLUMN IF NOT EXISTS copilot_sub_instance TEXT DEFAULT 'tenant_Comikids';
ALTER TABLE taller_config ADD COLUMN IF NOT EXISTS copilot_owner_phone TEXT DEFAULT '51927781412';
