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
    
    # Probar gemini-2.0-flash con curl directo en v1 y v1beta
    api_key = sys.argv[1] if len(sys.argv) > 1 else ""
    curl_v1beta = f"""curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{{"contents": [{{"parts": [{{"text": "Hola, responde 1 palabra"}}]}}]}}'"""
    _, out_beta, _ = ssh.exec_command(curl_v1beta)
    print("V1BETA RES:\n", out_beta.read().decode('utf-8'))

    # Test v1 endpoint
    curl_v1 = f"""curl -s -X POST "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key={api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{{"contents": [{{"parts": [{{"text": "Hola, responde 1 palabra"}}]}}]}}'"""

    _, out_v1, _ = ssh.exec_command(curl_v1)
    print("\nV1 RES:\n", out_v1.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
