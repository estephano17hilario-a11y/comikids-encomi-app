import paramiko

VPS_HOST = '89.117.73.97'
VPS_USER = 'root'
VPS_PASS = 'estephano10FM20home'

nginx_conf = """# Supabase Kong API Gateway
server {
    listen 80;
    listen [::]:80;
    server_name api.89.117.73.97.sslip.io;

    client_max_body_size 100M;

    location / {
        proxy_pass http://10.0.2.8:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Supabase Studio Dashboard
server {
    listen 80;
    listen [::]:80;
    server_name studio.89.117.73.97.sslip.io;

    client_max_body_size 50M;

    location / {
        proxy_pass http://10.0.2.13:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
