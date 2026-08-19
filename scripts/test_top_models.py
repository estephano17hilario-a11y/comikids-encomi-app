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

async function test(modelName) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const res = await model.generateContent('Hola ComiBot, responde en 1 linea confirmando que funcionas');
    console.log('[+] SUCCESS WITH ' + modelName + ':', res.response.text().trim());
  } catch (e) {
    console.log('[-] FAIL ' + modelName + ':', e.message);
  }
}

async function run() {
  await test('gemini-2.5-flash');
  await test('gemini-flash-latest');
  await test('gemini-3.6-flash');
}
run();
" """
    
    stdin, stdout, stderr = ssh.exec_command(test_cmd)
    print("TEST RESULTS:\n", stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
