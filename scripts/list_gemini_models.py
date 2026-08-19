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
    
    # List models via curl
    api_key = sys.argv[1] if len(sys.argv) > 1 else ""
    test_cmd = f"""curl -s "https://generativelanguage.googleapis.com/v1beta/models?key={api_key}" | jq '.models[] | {name: .name, supportedGenerationMethods: .supportedGenerationMethods}'"""

    
    stdin, stdout, stderr = ssh.exec_command(test_cmd)
    print("AVAILABLE MODELS IN YOUR KEY:\n", stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
