import paramiko
import json
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
    
    # 1. Fetch instances
    stdin, stdout, stderr = ssh.exec_command('curl -s -X GET "http://127.0.0.1:8080/instance/fetchInstances" -H "apikey: comikids_evolution_master_key_2026"')
    instances = stdout.read().decode('utf-8', errors='replace').strip()
    print("INSTANCES:\n", instances)

    # 2. Restart Baileys connection to generate fresh QR
    stdin, stdout, stderr = ssh.exec_command('curl -s -X POST "http://127.0.0.1:8080/instance/restart/comikids_whatsapp" -H "apikey: comikids_evolution_master_key_2026"')
    restart_res = stdout.read().decode('utf-8', errors='replace').strip()
    print("RESTART RESULT:\n", restart_res)

    ssh.close()

if __name__ == "__main__":
    main()
