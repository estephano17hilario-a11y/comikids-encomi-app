import paramiko
import json
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
    
    # Consultar QR
    cmd = 'curl -s -X GET "http://127.0.0.1:8080/instance/connect/comikids_whatsapp" -H "apikey: comikids_evolution_master_key_2026"'
    stdin, stdout, stderr = ssh.exec_command(cmd)
    res = stdout.read().decode('utf-8', errors='replace').strip()
    
    try:
        data = json.loads(res)
        print("STATUS:", data.get("state") or data.get("status") or "QR Ready")
        if "base64" in data:
            print("QR_BASE64_LENGTH:", len(data["base64"]))
        if "code" in data:
            print("QR_CODE:", data["code"][:60], "...")
        print("RAW RESPONSE:", json.dumps(data, indent=2))
    except Exception as e:
        print("RESPONSE:", res)
        
    ssh.close()

if __name__ == "__main__":
    main()
