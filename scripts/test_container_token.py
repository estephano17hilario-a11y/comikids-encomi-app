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
    
    # Test sending from inside backend_api container with instance token
    test_cmd = """docker exec backend_api node -e "
const axios = require('axios');
axios.post('http://evolution_api:8080/message/sendText/comikids_whatsapp', {
  number: '159377847771173@lid',
  text: '🤖 Test directo desde backend_api con instance token'
}, {
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'A27C33E1-9A89-442F-96FE-EA1D9F252A5B'
  }
}).then(r => console.log('CONTAINER SUCCESS:', r.data)).catch(e => console.log('CONTAINER FAIL:', e.response?.data || e.message));
" """
    
    stdin, stdout, stderr = ssh.exec_command(test_cmd)
    print("RESULT:\n", stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
