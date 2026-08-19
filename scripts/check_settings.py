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
    
    # 1. Settings
    _, out_s, _ = ssh.exec_command('curl -s http://127.0.0.1:8080/settings/find/comikids_whatsapp -H "apikey: comikids_evolution_master_key_2026"')
    print("SETTINGS:\n", out_s.read().decode('utf-8'))

    # 2. Webhook
    _, out_w, _ = ssh.exec_command('curl -s http://127.0.0.1:8080/webhook/find/comikids_whatsapp -H "apikey: comikids_evolution_master_key_2026"')
    print("\nWEBHOOK:\n", out_w.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
