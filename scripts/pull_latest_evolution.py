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
    
    print("[*] Verificando imagen latest de Evolution API...")
    _, out, _ = ssh.exec_command("docker pull evoapicloud/evolution-api:latest")
    print(out.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
