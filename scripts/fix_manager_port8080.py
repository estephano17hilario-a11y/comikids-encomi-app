import paramiko
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
    
    # 1. Habilitar puerto 8080 en UFW
    run_ssh_command(ssh, "ufw allow 8080/tcp comment 'Evolution API Web' && ufw status", "Abriendo puerto 8080 en UFW")

    # 2. Actualizar docker-compose.yml de Evolution para exponer 8080 públicamente
    compose_patch = """sed -i 's/127.0.0.1:8080:8080/8080:8080/g' /opt/evolution/docker-compose.yml"""
    run_ssh_command(ssh, compose_patch, "Modificando bind de puerto 8080")

    # 3. Reiniciar evolution_api con el nuevo puerto
    run_ssh_command(ssh, "cd /opt/evolution && docker compose up -d evolution_api", "Reiniciando contenedor evolution_api")

    # 4. Actualizar Nginx para servir /assets/ también desde el puerto 80
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

    # Manager UI de Evolution API
    location /manager {
        proxy_pass http://evolution_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static Assets del Manager
    location /assets/ {
        proxy_pass http://evolution_gateway/assets/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
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

    # Rutas API de Evolution
    location ~ ^/(instance|message|chat|group|label|profile|settings) {
        proxy_pass http://evolution_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Fastify Webhook Ingest
    location = /webhook/evolution {
        proxy_pass http://fastify_backend/webhook/evolution;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API Health & Default
    location /health {
        proxy_pass http://fastify_backend/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

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
    run_ssh_command(ssh, nginx_conf, "Actualizando configuracion Nginx con soporte /assets/")
    run_ssh_command(ssh, "nginx -t && systemctl reload nginx", "Recargando Nginx")

    # 5. Probar conexion a 8080 y /assets/
    run_ssh_command(ssh, "curl -s -I http://127.0.0.1:8080/manager/ | head -n 5", "Probando endpoint nativo 8080")
    run_ssh_command(ssh, "curl -s -I http://127.0.0.1/manager/ | head -n 5", "Probando endpoint Nginx /manager/")

    ssh.close()
    print("\n[+] Ajuste completado!")

if __name__ == "__main__":
    main()
