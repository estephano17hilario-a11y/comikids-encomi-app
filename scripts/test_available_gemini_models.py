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
    
    test_models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash", "gemini-1.5-flash-latest"]
    for m_name in test_models:
        test_cmd = f"""docker exec backend_api node -e "
const {{ GoogleGenerativeAI }} = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({{ model: '{m_name}' }});

async function run() {{
  try {{
    const result = await model.generateContent('Hola');
    console.log('MODEL {m_name} OK:', result.response.text().substring(0, 30));
  }} catch (err) {{
    console.log('MODEL {m_name} FAIL:', err.message || err);
  }}
}}
run();
" """
        _, out, _ = ssh.exec_command(test_cmd)
        print(out.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
