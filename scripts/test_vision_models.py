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
    
    # Probar vision multimodal en modelos mas economicos (flash-lite y flash)
    test_cmd = """docker exec backend_api node -e "
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1x1 transparent PNG en base64
const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const candidateModels = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-image',
  'gemini-2.5-flash-image',
  'gemini-3.6-flash'
];

async function runTest() {
  for (const m of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent([
        'Describe esta imagen en 5 palabras',
        {
          inlineData: {
            mimeType: 'image/png',
            data: sampleBase64
          }
        }
      ]);
      console.log('VISION TEST [' + m + ']: SUCCESS -> ' + res.response.text().trim().replace(/\\n/g, ' '));
    } catch (e) {
      console.log('VISION TEST [' + m + ']: FAIL -> ' + (e.status || e.message));
    }
  }
}
runTest();
" """
    
    stdin, stdout, stderr = ssh.exec_command(test_cmd)
    print("MULTIMODAL VISION RESULTS:\n", stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
