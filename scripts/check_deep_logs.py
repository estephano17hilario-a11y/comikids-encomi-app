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
    
    # 1. Logs backend (ultimos 60)
    _, out_back, _ = ssh.exec_command('docker logs --tail 60 backend_api')
    print("=== LOGS BACKEND FASTIFY ===")
    print(out_back.read().decode('utf-8'))

    # 2. Logs Evolution (ultimos 60)
    _, out_evo, _ = ssh.exec_command('docker logs --tail 60 evolution_api')
    print("\n=== LOGS EVOLUTION API ===")
    print(out_evo.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
