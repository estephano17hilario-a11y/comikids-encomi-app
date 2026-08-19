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
    
    # 1. Configurar Webhook a nivel de instancia en Evolution API
    set_wh_cmd = """curl -s -X POST "http://127.0.0.1:8080/webhook/set/comikids_whatsapp" \\
  -H "Content-Type: application/json" \\
  -H "apikey: comikids_evolution_master_key_2026" \\
  -d '{
    "webhook": {
      "enabled": true,
      "url": "http://backend_api:3000/webhook/evolution",
      "byEvents": false,
      "base64": true,
      "events": [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "CONNECTION_UPDATE"
      ]
    }
  }'"""
    stdin, stdout, stderr = ssh.exec_command(set_wh_cmd)
    res = stdout.read().decode('utf-8')
    print("SET WEBHOOK RESULT:\n", res)

    # 2. Verificar configuracion
    stdin, stdout, stderr = ssh.exec_command('curl -s -X GET "http://127.0.0.1:8080/webhook/find/comikids_whatsapp" -H "apikey: comikids_evolution_master_key_2026"')
    wh_find = stdout.read().decode('utf-8')
    print("\nWEBHOOK VERIFICADO:\n", wh_find)

    ssh.close()

if __name__ == "__main__":
    main()
