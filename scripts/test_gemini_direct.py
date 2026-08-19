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
    
    # Probar llamada directa a Gemini desde adentro del contenedor
    test_cmd = """docker exec backend_api node -e "
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });

async function run() {
  try {
    console.log('Testing model:', process.env.GEMINI_MODEL);
    const result = await model.generateContent('Hola, responde en una frase corta');
    console.log('SUCCESS RESULT:', result.response.text());
  } catch (err) {
    console.error('GEMINI ERROR FULL:', err);
  }
}
run();
" """
    
    stdin, stdout, stderr = ssh.exec_command(test_cmd)
    print("STDOUT:\n", stdout.read().decode('utf-8'))
    print("STDERR:\n", stderr.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
