import paramiko
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

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

    cmds = [
        "find / -name 'docker-compose.yml' 2>/dev/null",
        "find / -name '.git' 2>/dev/null",
        "docker logs --tail 25 backend_api"
    ]
    
    for c in cmds:
        print(f"\n--- [CMD] {c} ---")
        stdin, stdout, stderr = ssh.exec_command(c)
        out = stdout.read().decode('utf-8', errors='replace')
        print(out)

    ssh.close()

if __name__ == '__main__':
    main()
