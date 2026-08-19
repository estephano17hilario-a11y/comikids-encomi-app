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
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const pool = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];

async function testPool() {
  for (const m of pool) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent('Responde OK si funcionas');
      console.log('MODEL ' + m + ' STATUS: ONLINE -> ' + res.response.text().trim());
    } catch (e) {
      console.log('MODEL ' + m + ' STATUS: FAIL -> ' + e.message);
    }
  }
}
testPool();
" """
    
    stdin, stdout, stderr = ssh.exec_command(test_cmd)
    print("POOL TEST:\n", stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
