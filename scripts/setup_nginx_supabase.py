import paramiko

VPS_HOST = '89.117.73.97'
VPS_USER = 'root'
VPS_PASS = 'estephano10FM20home'

nginx_conf = """# ==========================================
# WebSocket Upgrade Mapping
# ==========================================
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

# ==========================================
# 1. HTTP Redirect to HTTPS
# ==========================================
server {
    listen 80;
    listen [::]:80;
    server_name api.89.117.73.97.sslip.io studio.89.117.73.97.sslip.io;
    return 301 https://$host$request_uri;
}

# ==========================================
# 2. Supabase Kong API Gateway (HTTPS & WSS)
# ==========================================
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.89.117.73.97.sslip.io;

    ssl_certificate /etc/letsencrypt/live/api.89.117.73.97.sslip.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.89.117.73.97.sslip.io/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 100M;

    location / {
        proxy_pass http://10.0.2.8:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }
}

# ==========================================
# 3. Supabase Studio Dashboard (HTTPS)
# ==========================================
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name studio.89.117.73.97.sslip.io;

    ssl_certificate /etc/letsencrypt/live/api.89.117.73.97.sslip.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.89.117.73.97.sslip.io/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 50M;

    location / {
        proxy_pass http://10.0.2.13:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
"""

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_HOST, 22, VPS_USER, VPS_PASS)
    
    sftp = ssh.open_sftp()
    with sftp.file('/etc/nginx/conf.d/supabase.conf', 'w') as f:
        f.write(nginx_conf)
    sftp.close()
    
    stdin, stdout, stderr = ssh.exec_command('nginx -t && systemctl reload nginx')
    print(stdout.read().decode())
    print(stderr.read().decode())
    ssh.close()

if __name__ == '__main__':
    main()
