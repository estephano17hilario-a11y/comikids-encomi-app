import paramiko
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
    
    # 1. Truncate Instance and Session tables in Postgres
    sql = 'TRUNCATE TABLE "Instance", "Session", "Setting", "Webhook", "Websocket" CASCADE;'
    cmd = f"docker exec evolution_postgres psql -U evolution_user -d evolution_db -c '{sql}'"
    _, out, _ = ssh.exec_command(cmd)
    print("TRUNCATE POSTGRES:\n", out.read().decode('utf-8'))

    # 2. Flush Redis
    _, out_redis, _ = ssh.exec_command("docker exec evolution_redis redis-cli -a comikids_redis_pass_2026 FLUSHALL")
    print("FLUSH REDIS:\n", out_redis.read().decode('utf-8'))

    # 3. Eliminar archivos de instancias
    _, out_rm, _ = ssh.exec_command("rm -rf /opt/evolution/instances/*")

    # 4. Reiniciar evolution_api
    _, out_res, _ = ssh.exec_command("cd /opt/evolution && docker compose restart evolution_api")
    print("RESTART EVOLUTION:\n", out_res.read().decode('utf-8'))

    print("[*] Esperando 10 segundos...")
    time.sleep(10)

    # 5. Crear la instancia comikids_whatsapp
    create_cmd = """curl -s -X POST "http://127.0.0.1:8080/instance/create" \\
  -H "Content-Type: application/json" \\
  -H "apikey: comikids_evolution_master_key_2026" \\
  -d '{
    "instanceName": "comikids_whatsapp",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'"""
    _, out_create, _ = ssh.exec_command(create_cmd)
    print("CREATE INSTANCE:\n", out_create.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
