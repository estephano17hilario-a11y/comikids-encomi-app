import paramiko
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def run_ssh_command(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace').strip()
    return exit_status, out

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
    
    # 1. Crear instancia comikids_whatsapp
    create_cmd = """curl -s -X POST "http://127.0.0.1:8080/instance/create" \\
  -H "Content-Type: application/json" \\
  -H "apikey: comikids_evolution_master_key_2026" \\
  -d '{
    "instanceName": "comikids_whatsapp",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'"""
    
    status, out = run_ssh_command(ssh, create_cmd)
    print(f"[CREATE INSTANCE RESULT]:\n{out}")

    # 2. Configurar Webhook en la instancia
    webhook_cmd = """curl -s -X POST "http://127.0.0.1:8080/webhook/set/comikids_whatsapp" \\
  -H "Content-Type: application/json" \\
  -H "apikey: comikids_evolution_master_key_2026" \\
  -d '{
    "enabled": true,
    "url": "http://backend_api:3000/webhook/evolution",
    "byEvents": true,
    "events": [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "CONNECTION_UPDATE"
    ]
  }'"""
    status, out = run_ssh_command(ssh, webhook_cmd)
    print(f"[SET WEBHOOK RESULT]:\n{out}")

    # 3. Obtener QR Code / Connect info
    connect_cmd = """curl -s -X GET "http://127.0.0.1:8080/instance/connect/comikids_whatsapp" -H "apikey: comikids_evolution_master_key_2026" """
    status, out = run_ssh_command(ssh, connect_cmd)
    print(f"[CONNECT STATUS / QR RESULT]:\n{out}")

    # 4. Estado general
    state_cmd = """curl -s -X GET "http://127.0.0.1:8080/instance/connectionState/comikids_whatsapp" -H "apikey: comikids_evolution_master_key_2026" """
    status, out = run_ssh_command(ssh, state_cmd)
    print(f"[CONNECTION STATE]:\n{out}")

    ssh.close()

if __name__ == "__main__":
    main()
