import paramiko
import time
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def run_ssh_command(ssh, cmd, title=""):
    if title:
        print("\n=======================================================")
        print(f"   [*] {title}")
        print("=======================================================")
    print(f"[EXEC] {cmd[:120]}..." if len(cmd) > 120 else f"[EXEC] {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    
    if out:
        print(f"[STDOUT]\n{out}")
    if err and exit_status != 0:
        print(f"[STDERR]\n{err}")
        
    if exit_status != 0:
        print(f"[WARN] Command exited with code: {exit_status}")
    return exit_status, out

def main():
    print(f"Connecting to VPS at {HOST} as {USER}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
        print("[+] Connected successfully via SSH!")
    except Exception as e:
        print(f"[-] Failed to connect to SSH: {e}")
        sys.exit(1)

    # 1. Instalar dependencias y Docker Engine oficial
    docker_install_cmd = """
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release jq ufw

# Configurar repositorio oficial de Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl restart docker
"""
    run_ssh_command(ssh, docker_install_cmd, "Instalando Docker Engine y Docker Compose V2 oficial")

    # 2. Verificar versión de Docker
    run_ssh_command(ssh, "docker --version && docker compose version", "Verificando Docker")

    # 3. Crear red interna Docker
    run_ssh_command(ssh, "docker network inspect internal-network >/dev/null 2>&1 || docker network create internal-network", "Creando red Docker internal-network")

    # 4. Crear estructura de carpetas
    run_ssh_command(ssh, "mkdir -p /opt/evolution/instances /opt/redis/data /opt/app/logs /opt/nginx/conf.d", "Creando estructura de directorios")

    # 5. Escribir /opt/evolution/.env
    env_content = """cat << 'EOF' > /opt/evolution/.env
AUTHENTICATION_API_KEY=comikids_evolution_master_key_2026
EVOLUTION_SERVER_URL=http://89.117.73.97:8080
EVOLUTION_DB_NAME=evolution_db
EVOLUTION_DB_USER=evolution_user
EVOLUTION_DB_PASSWORD=evolution_postgres_pass_2026
REDIS_PASSWORD=comikids_redis_pass_2026
EOF"""
    run_ssh_command(ssh, env_content, "Escribiendo /opt/evolution/.env")

    # 6. Escribir /opt/evolution/docker-compose.yml
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
      - "127.0.0.1:8080:8080"
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
      CONFIG_SESSION_PHONE_CLIENT: "Comikids WhatsApp AI"
      CONFIG_SESSION_PHONE_NAME: "Chrome"
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
    run_ssh_command(ssh, compose_content, "Escribiendo /opt/evolution/docker-compose.yml")

    # 7. Levantar contenedores
    run_ssh_command(ssh, "cd /opt/evolution && docker compose up -d", "Descargando imagenes y levantando contenedores")

    # 8. Esperar a que los contenedores estén healthy
    print("\n[*] Esperando 25 segundos para inicializacion de PostgreSQL, Redis y Evolution API...")
    time.sleep(25)
    run_ssh_command(ssh, "docker compose -f /opt/evolution/docker-compose.yml ps", "Estado de los contenedores")

    # 9. Test Evolution API root endpoint
    run_ssh_command(ssh, "curl -s http://127.0.0.1:8080 | jq", "Verificando respuesta de Evolution API v2")

    # 10. Crear la instancia comikids_whatsapp
    create_instance_cmd = """curl -s -X POST "http://127.0.0.1:8080/instance/create" \\
  -H "Content-Type: application/json" \\
  -H "apikey: comikids_evolution_master_key_2026" \\
  -d '{
    "instanceName": "comikids_whatsapp",
    "token": "",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS",
    "webhook": "http://backend_api:3000/webhook/evolution",
    "webhook_by_events": true,
    "events": [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "CONNECTION_UPDATE"
    ]
  }' | jq"""
    run_ssh_command(ssh, create_instance_cmd, "Creando instancia WhatsApp 'comikids_whatsapp'")

    # 11. Consultar estado y QR de conexion
    run_ssh_command(ssh, 'curl -s -X GET "http://127.0.0.1:8080/instance/connect/comikids_whatsapp" -H "apikey: comikids_evolution_master_key_2026" | jq', "Obteniendo datos de conexion / QR")

    ssh.close()
    print("\n[+] Despliegue de Fase 2 completado exitosamente en el VPS!")

if __name__ == "__main__":
    main()
