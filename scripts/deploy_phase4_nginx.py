import paramiko
import os
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
        
    return exit_status, out

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
    
    # 1. Instalar Nginx si no está instalado
    run_ssh_command(ssh, "apt-get update -y && apt-get install -y nginx", "Instalando Nginx en el VPS")

    # 2. Copiar configuracion de Nginx
    nginx_conf = """cat << 'EOF' > /etc/nginx/conf.d/comikids_app.conf
upstream fastify_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;
    keepalive 64;
}

upstream evolution_gateway {
    server 127.0.0.1:8080 max_fails=3 fail_timeout=10s;
    keepalive 64;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 32M;

    # Backend API Health & Routes
    location /health {
        proxy_pass http://fastify_backend/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhook Endpoint
    location /webhook/ {
        proxy_pass http://fastify_backend/webhook/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Evolution API Proxy
    location /evolution/ {
        proxy_pass http://evolution_gateway/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Default proxy to Fastify
    location / {
        proxy_pass http://fastify_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF"""
    run_ssh_command(ssh, nginx_conf, "Configurando Virtual Host en Nginx")

    # 3. Eliminar default site de Nginx si existe
    run_ssh_command(ssh, "rm -f /etc/nginx/sites-enabled/default", "Eliminando sitio default de Nginx")

    # 4. Probar y recargar Nginx
    run_ssh_command(ssh, "nginx -t && systemctl restart nginx", "Validando y reiniciando Nginx")

    # 5. Probar conexion externa
    run_ssh_command(ssh, "curl -s http://127.0.0.1/health | jq", "Verificando acceso via Nginx (puerto 80)")

    ssh.close()
    print("\n[+] Nginx configurado exitosamente!")

if __name__ == "__main__":
    main()
