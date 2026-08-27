import paramiko
import json
import urllib.request
import urllib.parse

VPS_HOST = '89.117.73.97'
VPS_USER = 'root'
VPS_PASS = 'estephano10FM20home'

# Cloud DB info
CLOUD_HOST = 'aws-0-us-west-2.pooler.supabase.com'
CLOUD_PORT = '6543'
CLOUD_USER = 'postgres.uwmdjsxwetjvsxsdngko'
CLOUD_PASS = 'estephano10FM20home'
CLOUD_DB = 'postgres'

LOCAL_CONTAINER = 'supabase-db-g2ydqdtovck8khde2nicmajz'

check_script = f"""#!/usr/bin/env bash
set -e

echo "=== A. COMPARANDO CONTEO DE FILAS (CLOUD vs VPS) ==="
echo "--- CLOUD ---"
docker run --rm -e PGPASSWORD="{CLOUD_PASS}" postgres:17-alpine psql -h {CLOUD_HOST} -p {CLOUD_PORT} -U {CLOUD_USER} -d {CLOUD_DB} -t -c "
SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
  SELECT table_name, query_to_xml(format('select count(*) as cnt from %I', table_name), false, true, '') as xml_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
) t ORDER BY table_name;
"

echo "--- VPS LOCAL ---"
docker exec -i {LOCAL_CONTAINER} psql -U postgres -d postgres -t -c "
SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
  SELECT table_name, query_to_xml(format('select count(*) as cnt from %I', table_name), false, true, '') as xml_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
) t ORDER BY table_name;
"

echo "=== B. VERIFICANDO SECUENCIAS (AUTO-INCREMENTS) ==="
docker exec -i {LOCAL_CONTAINER} psql -U postgres -d postgres -c "
SELECT sequence_name, last_value, is_called 
FROM information_schema.sequences s
LEFT JOIN pg_sequences ps ON ps.sequencename = s.sequence_name
WHERE sequence_schema = 'public';
"

echo "=== C. VERIFICANDO TRIGGERS Y FUNCIONES EN VPS ==="
docker exec -i {LOCAL_CONTAINER} psql -U postgres -d postgres -c "
SELECT trigger_schema, event_object_table, trigger_name, action_timing, event_manipulation 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
"

echo "=== D. VERIFICANDO POLITICAS DE SEGURIDAD (RLS) EN VPS ==="
docker exec -i {LOCAL_CONTAINER} psql -U postgres -d postgres -c "
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
"
"""

def test_api_crud():
    print("\n=== E. PRUEBA DE CRUD EN VIVO (INSERT -> SELECT -> DELETE) VIA API KONG ===")
    anon_key = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Nzg0OTc2MCwiZXhwIjo0OTQzNTIzMzYwLCJyb2xlIjoiYW5vbiJ9._DvifLx6sViDd5UePak7xswzmT6dQp9FoQZqPnyxeRU"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    test_id = "test-audit-migracion-vps"
    # 1. INSERT
    insert_url = "http://api.89.117.73.97.sslip.io/rest/v1/dni_cache"
    payload = json.dumps({
        "dni": "00000000",
        "nombres": "TEST MIGRACION AUDITORIA",
        "apellido_paterno": "VERIFICADO",
        "apellido_materno": "OK",
        "nombre_completo": "TEST MIGRACION AUDITORIA VERIFICADO OK"
    }).encode("utf-8")
    
    req = urllib.request.Request(insert_url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            print("✓ INSERT TEST EXITOSO. Status:", resp.status, resp.read().decode())
    except Exception as e:
        print("✗ Error en INSERT:", e)

    # 2. SELECT
    select_url = "http://api.89.117.73.97.sslip.io/rest/v1/dni_cache?dni=eq.00000000"
    req = urllib.request.Request(select_url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            print("✓ SELECT TEST EXITOSO:", resp.read().decode())
    except Exception as e:
        print("✗ Error en SELECT:", e)

    # 3. DELETE
    del_url = "http://api.89.117.73.97.sslip.io/rest/v1/dni_cache?dni=eq.00000000"
    req = urllib.request.Request(del_url, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(req) as resp:
            print("✓ DELETE TEST EXITOSO. Status:", resp.status)
    except Exception as e:
        print("✗ Error en DELETE:", e)

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_HOST, 22, VPS_USER, VPS_PASS, timeout=15)
    
    sftp = ssh.open_sftp()
    with sftp.file('/tmp/audit_script.sh', 'w') as f:
        f.write(check_script)
    sftp.chmod('/tmp/audit_script.sh', 0o755)
    sftp.close()
    
    stdin, stdout, stderr = ssh.exec_command('bash /tmp/audit_script.sh')
    
    for line in iter(stdout.readline, ""):
        print(line, end="")
    for err in iter(stderr.readline, ""):
        print(err, end="")
        
    ssh.close()
    
    test_api_crud()

if __name__ == '__main__':
    main()
