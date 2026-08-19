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
    
    # 1. Configurar Webhook con todos los eventos posibles
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
        "MESSAGES_SET",
        "SEND_MESSAGE",
        "CONNECTION_UPDATE",
        "CHATS_UPSERT",
        "CHATS_UPDATE",
        "CONTACTS_UPSERT",
        "CONTACTS_UPDATE"
      ]
    }
  }'"""
    stdin, stdout, stderr = ssh.exec_command(set_wh_cmd)
    print("SET WEBHOOK RESULT:\n", stdout.read().decode('utf-8'))

    # 2. Configurar Settings para no ignorar nada
    set_settings_cmd = """curl -s -X POST "http://127.0.0.1:8080/settings/set/comikids_whatsapp" \\
  -H "Content-Type: application/json" \\
  -H "apikey: comikids_evolution_master_key_2026" \\
  -d '{
    "rejectCall": false,
    "msgCall": "",
    "groupsIgnore": false,
    "alwaysOnline": true,
    "readMessages": true,
    "readStatus": false,
    "syncFullHistory": false
  }'"""
    stdin, stdout, stderr = ssh.exec_command(set_settings_cmd)
    print("SET SETTINGS RESULT:\n", stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
