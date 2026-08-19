import paramiko
import sys
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('89.117.73.97', 22, 'root', 'estephano10FM20home')

print("=======================================================")
print("   [*] 1. Últimos Logs de Docker backend_api")
print("=======================================================")
_, out, _ = ssh.exec_command('docker logs --tail 60 backend_api')
print(out.read().decode('utf-8', errors='replace'))

print("=======================================================")
print("   [*] 2. Instancias activas en Evolution API")
print("=======================================================")
_, out2, _ = ssh.exec_command('curl -s http://127.0.0.1:8080/instance/fetchInstances -H "apikey: comikids_evolution_master_key_2026" | jq')
print(out2.read().decode('utf-8', errors='replace'))

ssh.close()
