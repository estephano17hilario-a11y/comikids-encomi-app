import paramiko
import sys

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

    # Revisar procesos pm2, docker y puertos
    cmds = [
        "pm2 list || true",
        "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'",
        "ss -tulpn | grep -E '3000|8080'",
        "pm2 logs --lines 30 --nostream || true",
        "ls -la /var/www || ls -la /root || true"
    ]
    
    for c in cmds:
        print(f"\n--- [CMD] {c} ---")
        stdin, stdout, stderr = ssh.exec_command(c)
        out = stdout.read().decode('utf-8', errors='replace')
        print(out)

    ssh.close()

if __name__ == '__main__':
    main()
