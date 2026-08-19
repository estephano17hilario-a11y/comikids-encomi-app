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

    _, out, _ = ssh.exec_command("docker exec evolution_api env | grep API_KEY")
    print("EVOLUTION ENV:\n", out.read().decode('utf-8'))

    _, out1, _ = ssh.exec_command("""curl -s -X POST http://127.0.0.1:8080/instance/create -H 'apikey: comikids_evolution_master_key_2026' -H 'Content-Type: application/json' -d '{"instanceName": "tienda_demo_saas", "qrcode": true, "integration": "WHATSAPP-BAILEYS"}' """)
    print("TEST 1 RES:\n", out1.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
