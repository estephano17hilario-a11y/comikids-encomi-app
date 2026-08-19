import paramiko
import json
import time
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
    
    # 1. Simular mensaje entrante desde 159377847771173@lid
    test_cmd = """curl -s -X POST "http://127.0.0.1:3000/webhook/evolution" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "messages.upsert",
    "instance": "comikids_whatsapp",
    "data": {
      "key": {
        "remoteJid": "159377847771173@lid",
        "fromMe": false,
        "id": "TEST_LID_MSG_100"
      },
      "pushName": "Cliente Prueba",
      "messageType": "conversation",
      "message": {
        "conversation": "Hola! Quiero saber como comprar"
      }
    }
  }' | jq"""
    
    stdin, stdout, stderr = ssh.exec_command(test_cmd)
    print("WEBHOOK INGEST RES:\n", stdout.read().decode('utf-8'))

    print("[*] Esperando 4 segundos para procesamiento de Gemini y envio...")
    time.sleep(4)

    # 2. Ver logs de Fastify y Worker
    _, out_logs, _ = ssh.exec_command("docker logs --tail 30 backend_api")
    print("\nBACKEND LOGS:\n", out_logs.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
