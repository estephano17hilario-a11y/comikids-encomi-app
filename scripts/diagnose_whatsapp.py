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
    
    # 1. Estado de conexion en Evolution
    _, out_state, _ = ssh.exec_command('curl -s -X GET "http://127.0.0.1:8080/instance/connectionState/comikids_whatsapp" -H "apikey: comikids_evolution_master_key_2026"')
    print("=== ESTADO DE CONEXION WHATSAPP ===")
    print(out_state.read().decode('utf-8'))

    # 2. Logs de Evolution API
    _, out_evo, _ = ssh.exec_command('docker logs --tail 25 evolution_api')
    print("\n=== ULTIMOS LOGS EVOLUTION API ===")
    print(out_evo.read().decode('utf-8'))

    # 3. Logs de Backend Fastify
    _, out_back, _ = ssh.exec_command('docker logs --tail 25 backend_api')
    print("\n=== ULTIMOS LOGS BACKEND FASTIFY ===")
    print(out_back.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
