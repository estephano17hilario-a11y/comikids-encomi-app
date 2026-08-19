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
    
    # Probar envio directo de mensaje de prueba
    send_cmd = """curl -s -X POST "http://127.0.0.1:8080/message/sendText/comikids_whatsapp" \\
  -H "Content-Type: application/json" \\
  -H "apikey: comikids_evolution_master_key_2026" \\
  -d '{
    "number": "51901985319",
    "text": "🤖 [COMIKIDS BOT] ¡Hola! Tu sistema de chatbot está activo y funcionando correctamente.",
    "delay": 1000
  }' | jq"""
    stdin, stdout, stderr = ssh.exec_command(send_cmd)
    print("SEND TEXT RESULT:\n", stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
