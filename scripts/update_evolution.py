import paramiko, json, sys, time

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

for attempt in range(5):
    try:
        ssh.connect('89.117.73.97', username='root', password='estephano10FM20home', timeout=10)
        break
    except Exception as e:
        time.sleep(1)

def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    out = stdout.read().decode('utf-8', errors='ignore')
    return out

docker_compose_content = """services:
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
      WEBHOOK_EVENTS_QRCODE_UPDATED: "true"
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
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/evolution/docker-compose.yml', 'w') as f:
    f.write(docker_compose_content)
sftp.close()

print("Restarting evolution_api with updated docker-compose...")
print(run('cd /opt/evolution && docker compose up -d evolution_api'))
time.sleep(5)

API_KEY = 'comikids_evolution_master_key_2026'

# Force recreate comikids_whatsapp to test QR generation
run(f'curl -s -X DELETE -H "apikey: {API_KEY}" http://127.0.0.1:8080/instance/delete/comikids_whatsapp')
time.sleep(1)

create_payload = json.dumps({
    "instanceName": "comikids_whatsapp",
    "qrcode": True,
    "integration": "WHATSAPP-BAILEYS"
})
res_create = run(f'curl -s -X POST -H "apikey: {API_KEY}" -H "Content-Type: application/json" -d \'{create_payload}\' http://127.0.0.1:8080/instance/create')
print("RECREATED INSTANCE:", res_create)

time.sleep(3)

print("CONNECT RESULT:")
print(run(f'curl -s -H "apikey: {API_KEY}" http://127.0.0.1:8080/instance/connect/comikids_whatsapp'))

print("BACKEND QR ENDPOINT:")
print(run('curl -s http://127.0.0.1:3000/tenant/comikids_whatsapp/qr'))
