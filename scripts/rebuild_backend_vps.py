import paramiko
import sys
import time

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
        print("[+] Conectado a VPS!")
    except Exception as e:
        print(f"[-] Error SSH: {e}")
        return

    # Buscar la ruta del código del backend en el VPS
    cmds = [
        "find /root /var /home -maxdepth 4 -name 'backend' -type d 2>/dev/null",
        "docker inspect backend_api | grep -i 'workingdir\\|source\\|destination\\|image' | head -n 20",
        "docker logs --tail 30 backend_api"
    ]
    
    for c in cmds:
        print(f"\n--- [CMD] {c} ---")
        stdin, stdout, stderr = ssh.exec_command(c)
        out = stdout.read().decode('utf-8', errors='replace')
        print(out)

    ssh.close()

if __name__ == '__main__':
    main()
