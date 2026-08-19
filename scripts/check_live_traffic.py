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
    
    # 1. Webhook config of comikids_whatsapp
    _, out_wh, _ = ssh.exec_command('curl -s -X GET "http://127.0.0.1:8080/webhook/find/comikids_whatsapp" -H "apikey: comikids_evolution_master_key_2026"')
    print("=== WEBHOOK CONFIG EN EVOLUTION ===")
    print(out_wh.read().decode('utf-8'))

    # 2. Logs de Evolution API
    _, out_evo, _ = ssh.exec_command('docker logs --tail 40 evolution_api')
    print("\n=== LOGS EVOLUTION API ===")
    print(out_evo.read().decode('utf-8'))

    # 3. Logs de Backend Fastify
    _, out_back, _ = ssh.exec_command('docker logs --tail 40 backend_api')
    print("\n=== LOGS BACKEND FASTIFY ===")
    print(out_back.read().decode('utf-8'))

    # 4. Metrics
    _, out_health, _ = ssh.exec_command('curl -s http://127.0.0.1:3000/health | jq')
    print("\n=== HEALTH & QUEUE METRICS ===")
    print(out_health.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
