import paramiko
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
    
    # 1. Actualizar configuración de Nginx para incluir /manager y assets
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

    # Rutas de Evolution API directas
    location ~ ^/(instance|message|chat|group|label|profile|webhook|settings) {
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
    ssh.exec_command(nginx_conf)
    
    # 2. Recargar Nginx
    stdin, stdout, stderr = ssh.exec_command('nginx -t && systemctl reload nginx')
    print("NGINX RELOAD:", stdout.read().decode('utf-8'), stderr.read().decode('utf-8'))

    # 3. Probar acceso a /manager
    stdin, stdout, stderr = ssh.exec_command('curl -s -I http://127.0.0.1/manager')
    print("CURL /manager:", stdout.read().decode('utf-8'))

    # 4. Probar acceso a /manager/
    stdin, stdout, stderr = ssh.exec_command('curl -s -I http://127.0.0.1/manager/')
    print("CURL /manager/:", stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
