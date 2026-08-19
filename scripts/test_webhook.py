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
    
    # Simular webhook de prueba
    test_webhook_cmd = """curl -s -X POST "http://127.0.0.1/webhook/evolution" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "messages.upsert",
    "instance": "comikids_whatsapp",
    "data": {
      "key": {
        "remoteJid": "51987654321@s.whatsapp.net",
        "fromMe": false,
        "id": "TEST_MESSAGE_ID_001"
      },
      "pushName": "Cliente Demo",
      "messageType": "conversation",
      "message": {
        "conversation": "Hola, quiero consultar el estado de mi pedido"
      }
    }
  }' | jq"""
    
    stdin, stdout, stderr = ssh.exec_command(test_webhook_cmd)
    res = stdout.read().decode('utf-8', errors='replace').strip()
    print("WEBHOOK SIMULATION RESULT:\n", res)

    # Verificar métricas de cola
    stdin, stdout, stderr = ssh.exec_command("curl -s http://127.0.0.1/health | jq")
    health = stdout.read().decode('utf-8', errors='replace').strip()
    print("\nHEALTH & QUEUE METRICS:\n", health)

    # Ver logs del worker
    stdin, stdout, stderr = ssh.exec_command("docker logs --tail 15 backend_api")
    logs = stdout.read().decode('utf-8', errors='replace').strip()
    print("\nBACKEND & WORKER LOGS:\n", logs)

    ssh.close()

if __name__ == "__main__":
    main()
