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
    
    test_cmd = """docker exec backend_api node -e "import('./dist/services/gemini.service.js').then(async m => { const res = await m.GeminiService.generateAssistantResponse('Hola! Quiero hacer un pedido', { customerName: 'Estephano' }); console.log('RESPONSE:', res); })" """
    
    stdin, stdout, stderr = ssh.exec_command(test_cmd)
    print("STDOUT:\n", stdout.read().decode('utf-8'))
    print("STDERR:\n", stderr.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
