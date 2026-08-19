import paramiko
import os
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

def upload_directory(sftp, local_dir, remote_dir):
    try:
        sftp.mkdir(remote_dir)
    except IOError:
        pass

    for item in os.listdir(local_dir):
        if item in ['node_modules', 'dist', '.git', '.tmp']:
            continue
        local_path = os.path.join(local_dir, item)
        remote_path = f"{remote_dir}/{item}".replace('\\', '/')

        if os.path.isdir(local_path):
            upload_directory(sftp, local_path, remote_path)
        else:
            print(f"  -> Subiendo: {remote_path}")
            sftp.put(local_path, remote_path)

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

    # 1. Crear directorios base en /opt/app
    run_ssh_command(ssh, "mkdir -p /opt/app/logs", "Preparando directorio /opt/app")

    # 2. Subir archivos con SFTP
    print("\n[*] Subiendo código fuente del backend Fastify + BullMQ...")
    sftp = ssh.open_sftp()
    local_backend_dir = os.path.abspath("backend")
    upload_directory(sftp, local_backend_dir, "/opt/app")
    sftp.close()
    print("[+] Archivos subidos exitosamente.")

    # 3. Escribir /opt/app/.env
    env_content = """cat << 'EOF' > /opt/app/.env
# ==============================================================================
# CONFIGURACION DEL BACKEND FASTIFY + BULLMQ (ENCOMI SAAS MULTI-TENANT)
# ==============================================================================
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Redis Broker (Red interna Docker)
REDIS_HOST=evolution_redis
REDIS_PORT=6379
REDIS_PASSWORD=comikids_redis_pass_2026
REDIS_DB=0

# Motores de IA Multimodal (OpenRouter & Gemini Fallback)
OPENROUTER_API_KEY=
AI_MODEL=qwen/qwen3.7-flash
GEMINI_API_KEY=${GEMINI_API_KEY:-}

GEMINI_MODEL=gemini-3.1-flash-lite

# Base de Datos de Negocio (Supabase)
SUPABASE_URL=https://uwmdjsxwetjvsxsdngko.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bWRqc3h3ZXRqdnN4c2RuZ2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDE5MTEsImV4cCI6MjEwMjIxNzkxMX0.KaqryIyoe4IDQGTJD_cswZkW-wfgnMcyV9tJoWxHMq8

# Gateway WhatsApp (Evolution API v2)
EVOLUTION_API_URL=http://evolution_api:8080
EVOLUTION_API_KEY=comikids_evolution_master_key_2026
EVOLUTION_INSTANCE_NAME=comikids_whatsapp

# Shalom Logistics
SHALOM_API_KEY=sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma
SHALOM_API_URL=https://api.shalom-api-peru.com
EOF"""
    run_ssh_command(ssh, env_content, "Escribiendo /opt/app/.env")


    # 4. Construir y desplegar el contenedor del backend
    run_ssh_command(ssh, "cd /opt/app && docker compose build --no-cache && docker compose up -d", "Construyendo y arrancando backend_api")

    # 5. Esperar estabilización
    print("\n[*] Esperando 12 segundos para inicio del servidor Fastify y workers BullMQ...")
    time.sleep(12)

    # 6. Verificar estado de contenedores
    run_ssh_command(ssh, "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'", "Estado general de contenedores en el VPS")

    # 7. Test Healthcheck
    run_ssh_command(ssh, "curl -s http://127.0.0.1:3000/health | jq", "Verificando Healthcheck y metricas de BullMQ")

    # 8. Ver logs del backend
    run_ssh_command(ssh, "docker logs --tail 25 backend_api", "Logs de inicio de Fastify y BullMQ")

    ssh.close()
    print("\n[+] FASE 3 completada con exito en el VPS!")

if __name__ == "__main__":
    main()
