import os
import paramiko
import time

VPS_HOST = '89.117.73.97'
VPS_USER = 'root'
VPS_PASS = 'estephano10FM20home'

def deploy():
    print("[DEPLOY] Conectando a VPS por SSH/SFTP...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_HOST, 22, VPS_USER, VPS_PASS, timeout=30)
    sftp = ssh.open_sftp()

    def upload_dir(local_path, remote_path):
        try:
            sftp.mkdir(remote_path)
        except Exception:
            pass
        for item in os.listdir(local_path):
            l_item = os.path.join(local_path, item)
            r_item = f"{remote_path}/{item}"
            if os.path.isdir(l_item):
                upload_dir(l_item, r_item)
            else:
                sftp.put(l_item, r_item)

    print("[DEPLOY] Subiendo archivos compilados de /dist a /opt/app/dist...")
    upload_dir('backend/dist', '/opt/app/dist')

    print("[DEPLOY] Subiendo codigo fuente de /src a /opt/app/src...")
    upload_dir('backend/src', '/opt/app/src')

    print("[DEPLOY] Subiendo package.json...")
    sftp.put('backend/package.json', '/opt/app/package.json')
    sftp.close()

    print("[DEPLOY] Verificando .env en VPS...")
    env_update_cmd = "sed -i 's|http://api.89.117.73.97.sslip.io|https://api.89.117.73.97.sslip.io|g' /opt/app/.env"
    ssh.exec_command(env_update_cmd)

    print("[DEPLOY] Reconstruyendo y reiniciando contenedor backend_api con docker compose...")
    stdin, stdout, stderr = ssh.exec_command("cd /opt/app && docker compose build backend_api && docker compose up -d backend_api")
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print("[DEPLOY] Docker Compose terminado.")

    time.sleep(3)
    print("[DEPLOY] Verificando logs del backend:")
    stdin, stdout, stderr = ssh.exec_command("docker logs --tail 25 backend_api")
    log_out = stdout.read().decode('utf-8', errors='replace')
    with open('scripts/deploy_log.txt', 'w', encoding='utf-8') as f:
        f.write(log_out)
    print("[DEPLOY] Logs guardados en scripts/deploy_log.txt")

    ssh.close()
    print("[DEPLOY] Despliegue completado con exito!")

if __name__ == '__main__':
    deploy()
