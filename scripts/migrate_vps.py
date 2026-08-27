import paramiko

VPS_HOST = '89.117.73.97'
VPS_USER = 'root'
VPS_PASS = 'estephano10FM20home'

# Cloud DB info
CLOUD_HOST = 'aws-0-us-west-2.pooler.supabase.com'
CLOUD_PORT = '6543'
CLOUD_USER = 'postgres.uwmdjsxwetjvsxsdngko'
CLOUD_PASS = 'estephano10FM20home'
CLOUD_DB = 'postgres'

# Target Local DB container on VPS
LOCAL_CONTAINER = 'supabase-db-g2ydqdtovck8khde2nicmajz'
LOCAL_DB = 'postgres'
LOCAL_USER = 'postgres'

remote_script = f"""#!/usr/bin/env bash
set -e

echo "=== 1. Asegurando extensiones en base de datos local ==="
docker exec -i {LOCAL_CONTAINER} psql -U {LOCAL_USER} -d {LOCAL_DB} << 'EOSQL'
CREATE EXTENSION IF NOT EXISTS postgis CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto CASCADE;
EOSQL

echo "=== 2. Realizando volcado de datos y esquema (Plain SQL compatible) ==="
docker run --rm \\
  -e PGPASSWORD="{CLOUD_PASS}" \\
  -v /tmp:/backup \\
  postgres:17-alpine \\
  pg_dump -h {CLOUD_HOST} -p {CLOUD_PORT} -U {CLOUD_USER} -d {CLOUD_DB} \\
  --schema=public \\
  --clean \\
  --if-exists \\
  --no-owner \\
  --no-privileges \\
  --file=/backup/encomi_full_clean.sql

echo "=== 3. Limpiando directivas incompatibles de PG17 para PG15 ==="
sed -i '/^\\\\restrict/d' /tmp/encomi_full_clean.sql
sed -i '/^\\\\unrestrict/d' /tmp/encomi_full_clean.sql
sed -i 's/SET transaction_timeout = 0;/-- SET transaction_timeout = 0;/g' /tmp/encomi_full_clean.sql

echo "=== 4. Copiando e inyectando backup en el contenedor local ==="
docker cp /tmp/encomi_full_clean.sql {LOCAL_CONTAINER}:/tmp/encomi_full_clean.sql

docker exec -i {LOCAL_CONTAINER} psql -U {LOCAL_USER} -d {LOCAL_DB} -f /tmp/encomi_full_clean.sql > /tmp/restore_output.log 2>&1 || true

echo "=== Resumen de errores si los hubo ==="
grep -E "ERROR:" /tmp/restore_output.log | sort | uniq -c || echo "No critical errors found."

echo "=== 5. Verificando conteo de tablas y filas en el VPS ==="
docker exec -i {LOCAL_CONTAINER} psql -U {LOCAL_USER} -d {LOCAL_DB} -c "
SELECT 
    schemaname, 
    relname as table_name, 
    n_live_tup as row_count 
FROM pg_stat_user_tables 
WHERE schemaname = 'public' 
ORDER BY relname;
"

echo "=== 6. Total de tablas migradas ==="
docker exec -i {LOCAL_CONTAINER} psql -U {LOCAL_USER} -d {LOCAL_DB} -t -A -c "
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
"
"""

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Conectando a VPS {VPS_HOST}...")
    ssh.connect(VPS_HOST, 22, VPS_USER, VPS_PASS, timeout=15)
    
    sftp = ssh.open_sftp()
    with sftp.file('/tmp/do_migration.sh', 'w') as f:
        f.write(remote_script)
    sftp.chmod('/tmp/do_migration.sh', 0o755)
    sftp.close()
    
    print("Ejecutando migración limpia...")
    stdin, stdout, stderr = ssh.exec_command('bash /tmp/do_migration.sh')
    
    for line in iter(stdout.readline, ""):
        print(line, end="")
    for err in iter(stderr.readline, ""):
        print(err, end="")
        
    ssh.close()

if __name__ == '__main__':
    main()
