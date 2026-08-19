import paramiko
import json
import base64
import time
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def run_ssh_command(ssh, cmd, title=""):
    print(f"\n[*] {title}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out:
        print(f"[STDOUT] {out}")
    if err and exit_status != 0:
        print(f"[STDERR] {err}")
    return exit_status, out

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
    
    # 1. Reescribir docker-compose.yml de Evolution con soporte WebSocket y configuración Baileys limpia
    compose_content = """cat << 'EOF' > /opt/evolution/docker-compose.yml
services:
  evolution_redis:
    image: redis:7-alpine
    container_name: evolution_redis
    restart: unless-stopped
    command: >
      redis-server
      --requirepass comikids_redis_pass_2026
      --appendonly yes
      --appendfsync everysec
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
    volumes:
      - /opt/redis/data:/data
    networks:
      - internal-network
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "comikids_redis_pass_2026", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  evolution_postgres:
    image: postgres:16-alpine
    container_name: evolution_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: evolution_db
      POSTGRES_USER: evolution_user
      POSTGRES_PASSWORD: evolution_postgres_pass_2026
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - evolution_postgres_data:/var/lib/postgresql/data
    networks:
      - internal-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U evolution_user -d evolution_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  evolution_api:
    image: evoapicloud/evolution-api:v2.2.3
    container_name: evolution_api
    restart: unless-stopped
    depends_on:
      evolution_redis:
        condition: service_healthy
      evolution_postgres:
        condition: service_healthy
    ports:
      - "8080:8080"
    environment:
      SERVER_TYPE: http
      SERVER_PORT: 8080
      SERVER_URL: http://89.117.73.97:8080
      AUTHENTICATION_API_KEY: comikids_evolution_master_key_2026
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: postgresql://evolution_user:evolution_postgres_pass_2026@evolution_postgres:5432/evolution_db?schema=public
      DATABASE_CONNECTION_CLIENT_NAME: evolution_v2
      CACHE_REDIS_ENABLED: "true"
      CACHE_REDIS_URI: redis://:comikids_redis_pass_2026@evolution_redis:6379/1
      CACHE_REDIS_PREFIX_KEY: evolution
      CACHE_REDIS_SAVE_INSTANCES: "true"
      WEBHOOK_GLOBAL_ENABLED: "true"
      WEBHOOK_GLOBAL_URL: http://backend_api:3000/webhook/evolution
      WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS: "true"
      WEBHOOK_EVENTS_MESSAGES_UPSERT: "true"
      WEBHOOK_EVENTS_MESSAGES_UPDATE: "true"
      WEBHOOK_EVENTS_CONNECTION_UPDATE: "true"
      WEBSOCKET_GLOBAL_ENABLED: "true"
      WEBSOCKET_GLOBAL_EVENTS: "true"
      WEBSOCKET_EVENTS_QRCODE_UPDATED: "true"
      WEBSOCKET_EVENTS_CONNECTION_UPDATE: "true"
      WEBSOCKET_EVENTS_MESSAGES_UPSERT: "true"
      QRCODE_LIMIT: "30"
      DEL_INSTANCE: "false"
      STORE_MESSAGES: "true"
      STORE_MESSAGE_UP: "true"
      STORE_CONTACTS: "true"
      STORE_CHATS: "true"
    volumes:
      - /opt/evolution/instances:/evolution/instances
    networks:
      - internal-network

volumes:
  evolution_postgres_data:
    name: evolution_postgres_data

networks:
  internal-network:
    external: true
EOF"""
    run_ssh_command(ssh, compose_content, "Actualizando docker-compose.yml con WebSockets")

    # 2. Limpiar instancias viejas y reiniciar contenedor
    run_ssh_command(ssh, "cd /opt/evolution && docker compose stop evolution_api && rm -rf /opt/evolution/instances/* && docker compose up -d evolution_api", "Reiniciando Evolution API")

    print("\n[*] Esperando 15 segundos para inicio de socket...")
    time.sleep(15)

    # 3. Crear instancia limpia
    create_cmd = """curl -s -X POST "http://127.0.0.1:8080/instance/create" \\
  -H "Content-Type: application/json" \\
  -H "apikey: comikids_evolution_master_key_2026" \\
  -d '{
    "instanceName": "comikids_whatsapp",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'"""
    _, create_res = run_ssh_command(ssh, create_cmd, "Creando instancia comikids_whatsapp")
    print("CREATE RESULT:", create_res)

    print("\n[*] Esperando 5 segundos para generacion de QR...")
    time.sleep(5)

    # 4. Consultar QR
    connect_cmd = 'curl -s -X GET "http://127.0.0.1:8080/instance/connect/comikids_whatsapp" -H "apikey: comikids_evolution_master_key_2026"'
    _, connect_res = run_ssh_command(ssh, connect_cmd, "Consultando QR")
    
    try:
        data = json.loads(connect_res)
        b64 = data.get("base64")
        code = data.get("code")
        pairing = data.get("pairingCode")
        
        if b64:
            clean_b64 = b64.replace("data:image/png;base64,", "")
            img_bytes = base64.b64decode(clean_b64)
            output_path = os.path.abspath("public/whatsapp_qr.png")
            with open(output_path, "wb") as f:
                f.write(img_bytes)
            print(f"\n🎉 EXITO: IMAGEN QR GUARDADA EN: {output_path}")
        else:
            print("Response:", data)
    except Exception as e:
        print("Parse error:", e)

    ssh.close()

if __name__ == "__main__":
    main()
