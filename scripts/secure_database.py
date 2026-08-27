import paramiko

VPS_HOST = '89.117.73.97'
VPS_USER = 'root'
VPS_PASS = 'estephano10FM20home'
LOCAL_CONTAINER = 'supabase-db-g2ydqdtovck8khde2nicmajz'

setup_script = """#!/usr/bin/env bash
set -e

echo "=== 1. VERIFICANDO Y CREANDO BUCKETS DE STORAGE NECESARIOS ==="
docker exec -i supabase-db-g2ydqdtovck8khde2nicmajz psql -U postgres -d postgres << 'EOSQL'
-- Crear buckets si no existen
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('comprobantes', 'comprobantes', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('pedidos', 'pedidos', true, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('referencias', 'referencias', true, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de Storage para lectura y subida segura
DROP POLICY IF EXISTS "Public Access Storage" ON storage.objects;
CREATE POLICY "Public Access Storage" ON storage.objects 
  FOR SELECT USING (bucket_id IN ('comprobantes', 'pedidos', 'referencias'));

DROP POLICY IF EXISTS "Public Upload Storage" ON storage.objects;
CREATE POLICY "Public Upload Storage" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id IN ('comprobantes', 'pedidos', 'referencias'));

DROP POLICY IF EXISTS "Public Update Storage" ON storage.objects;
CREATE POLICY "Public Update Storage" ON storage.objects 
  FOR UPDATE USING (bucket_id IN ('comprobantes', 'pedidos', 'referencias'));

-- Permisos sobre storage
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO anon, authenticated, service_role;
EOSQL

echo "=== 2. VERIFICANDO RLS Y POLITICAS EN TABLAS PUBLICAS ==="
docker exec -i supabase-db-g2ydqdtovck8khde2nicmajz psql -U postgres -d postgres << 'EOSQL'
-- Asegurar que RLS este habilitado en tablas sensibles y existan politicas completas
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprobantes_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logros_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taller_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metodos_envio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.olva_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shalom_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensajes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dni_cache ENABLE ROW LEVEL SECURITY;

-- Politicas para pedidos
DROP POLICY IF EXISTS "pedidos_read_all" ON public.pedidos;
CREATE POLICY "pedidos_read_all" ON public.pedidos FOR SELECT USING (true);

DROP POLICY IF EXISTS "pedidos_insert_all" ON public.pedidos;
CREATE POLICY "pedidos_insert_all" ON public.pedidos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "pedidos_update_all" ON public.pedidos;
CREATE POLICY "pedidos_update_all" ON public.pedidos FOR UPDATE USING (true);

-- Politicas para usuarios
DROP POLICY IF EXISTS "usuarios_read_all" ON public.usuarios;
CREATE POLICY "usuarios_read_all" ON public.usuarios FOR SELECT USING (true);

DROP POLICY IF EXISTS "usuarios_insert_all" ON public.usuarios;
CREATE POLICY "usuarios_insert_all" ON public.usuarios FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "usuarios_update_all" ON public.usuarios;
CREATE POLICY "usuarios_update_all" ON public.usuarios FOR UPDATE USING (true);

-- Politicas para comprobantes_pago
DROP POLICY IF EXISTS "comprobantes_read_all" ON public.comprobantes_pago;
CREATE POLICY "comprobantes_read_all" ON public.comprobantes_pago FOR SELECT USING (true);

DROP POLICY IF EXISTS "comprobantes_insert_all" ON public.comprobantes_pago;
CREATE POLICY "comprobantes_insert_all" ON public.comprobantes_pago FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "comprobantes_update_all" ON public.comprobantes_pago;
CREATE POLICY "comprobantes_update_all" ON public.comprobantes_pago FOR UPDATE USING (true);

-- Politicas para logros_cliente
DROP POLICY IF EXISTS "logros_read_all" ON public.logros_cliente;
CREATE POLICY "logros_read_all" ON public.logros_cliente FOR SELECT USING (true);

DROP POLICY IF EXISTS "logros_insert_all" ON public.logros_cliente;
CREATE POLICY "logros_insert_all" ON public.logros_cliente FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "logros_update_all" ON public.logros_cliente;
CREATE POLICY "logros_update_all" ON public.logros_cliente FOR UPDATE USING (true);

-- Politicas para taller_config
DROP POLICY IF EXISTS "taller_read_all" ON public.taller_config;
CREATE POLICY "taller_read_all" ON public.taller_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "taller_update_all" ON public.taller_config;
CREATE POLICY "taller_update_all" ON public.taller_config FOR UPDATE USING (true);

-- Politicas para metodos_envio
DROP POLICY IF EXISTS "metodos_read_all" ON public.metodos_envio;
CREATE POLICY "metodos_read_all" ON public.metodos_envio FOR SELECT USING (true);

-- Politicas para whatsapp_mensajes_log
DROP POLICY IF EXISTS "whatsapp_log_read_all" ON public.whatsapp_mensajes_log;
CREATE POLICY "whatsapp_log_read_all" ON public.whatsapp_mensajes_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "whatsapp_log_insert_all" ON public.whatsapp_mensajes_log;
CREATE POLICY "whatsapp_log_insert_all" ON public.whatsapp_mensajes_log FOR INSERT WITH CHECK (true);
EOSQL

echo "=== 3. CONFIGURANDO SISTEMA DE BACKUPS AUTOMATIZADOS (CRON DIARIO) ==="
mkdir -p /data/backups/supabase
cat << 'CRONSCRIPT' > /usr/local/bin/supabase_backup.sh
#!/bin/bash
BACKUP_DIR="/data/backups/supabase"
DATE=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/encomi_db_$DATE.sql.gz"

mkdir -p "$BACKUP_DIR"
docker exec supabase-db-g2ydqdtovck8khde2nicmajz pg_dump -U postgres -d postgres | gzip > "$FILENAME"

# Mantener ultimos 14 dias de backups
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +14 -delete
echo "[$(date)] Backup realizado con exito en $FILENAME" >> /var/log/supabase_backup.log
CRONSCRIPT

chmod +x /usr/local/bin/supabase_backup.sh

# Agregar al crontab si no existe (corre diario a las 3:00 AM)
(crontab -l 2>/dev/null | grep -v 'supabase_backup.sh' ; echo "0 3 * * * /usr/local/bin/supabase_backup.sh") | crontab -

# Ejecutar un backup inicial de prueba
/usr/local/bin/supabase_backup.sh

echo "=== 4. LISTANDO BACKUPS DISPONIBLES ==="
ls -lh /data/backups/supabase/
"""

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_HOST, 22, VPS_USER, VPS_PASS)
    
    sftp = ssh.open_sftp()
    with sftp.file('/tmp/secure_database.sh', 'w') as f:
        f.write(setup_script)
    sftp.chmod('/tmp/secure_database.sh', 0o755)
    sftp.close()
    
    stdin, stdout, stderr = ssh.exec_command('bash /tmp/secure_database.sh')
    print(stdout.read().decode())
    print(stderr.read().decode())
    ssh.close()

if __name__ == '__main__':
    main()
