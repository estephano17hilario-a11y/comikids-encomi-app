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
    
    test_cmd = """docker exec backend_api node -e "
import('./dist/services/evolution.service.js').then(async m => {
  try {
    const res = await m.EvolutionService.sendTextMessage('159377847771173@lid', 'Test desde EvolutionService');
    console.log('SEND SUCCESS:', res);
  } catch (e) {
    console.log('SEND ERROR URL:', e.config?.url);
    console.log('SEND ERROR HEADERS:', e.config?.headers);
    console.log('SEND ERROR DATA:', e.response?.data);
  }
})" """
    
    stdin, stdout, stderr = ssh.exec_command(test_cmd)
    print("STDOUT:\n", stdout.read().decode('utf-8'))
    print("STDERR:\n", stderr.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
