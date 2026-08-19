import paramiko
import urllib.request
import json

import time
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"[*] Conectando al VPS {HOST}...")
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
    print("[+] Conectado!")

    print("\n[*] 1. Actualizando /opt/app/docker-compose.yml con 0.0.0.0:3000:3000...")
    sftp = ssh.open_sftp()
    with open("backend/docker-compose.yml", "rb") as f:
        sftp.putfo(f, "/opt/app/docker-compose.yml")
    sftp.close()

    print("\n[*] 2. Habilitando puerto 3000 en el Firewall (ufw & iptables)...")
    ssh.exec_command("ufw allow 3000/tcp || true")
    ssh.exec_command("iptables -I INPUT -p tcp --dport 3000 -j ACCEPT || true")

    print("\n[*] 3. Reiniciando contenedor backend_api en el VPS...")
    _, out, _ = ssh.exec_command("cd /opt/app && docker compose up -d --force-recreate")
    print(out.read().decode('utf-8', errors='replace'))

    time.sleep(3)

    print("\n[*] 4. Verificando puertos de Docker...")
    _, out_ps, _ = ssh.exec_command("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")
    print(out_ps.read().decode('utf-8', errors='replace'))

    ssh.close()

    print("\n[*] 5. Probando conexión externa directa desde tu navegador/computadora...")
    try:
        req = urllib.request.urlopen("http://89.117.73.97:3000/health", timeout=5)
        print(f"[+] Healthcheck HTTP {req.status}: {req.read().decode('utf-8')}")

        req2 = urllib.request.urlopen("http://89.117.73.97:3000/api/tenant/instances", timeout=5)
        print(f"[+] Instances API HTTP {req2.status}: {req2.read().decode('utf-8')}")
        print("\n🎉 ¡Puerto 3000 abierto y accesible públicamente con éxito!")
    except Exception as e:
        print(f"[-] Error de conexión externa: {e}")


if __name__ == "__main__":
    main()
