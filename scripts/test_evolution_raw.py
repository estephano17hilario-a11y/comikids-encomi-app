import paramiko
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('89.117.73.97', 22, 'root', 'estephano10FM20home')

# Probar creación simple en Evolution
cmd = """curl -s -X POST http://127.0.0.1:8080/instance/create \
  -H "apikey: comikids_evolution_master_key_2026" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "test_raw_inst", "qrcode": true, "integration": "WHATSAPP-BAILEYS"}'
"""
_, out, _ = ssh.exec_command(cmd)
print("EVOLUTION RAW CREATE RESULT:")
print(out.read().decode('utf-8'))

# Eliminar para limpiar
ssh.exec_command('curl -s -X DELETE http://127.0.0.1:8080/instance/delete/test_raw_inst -H "apikey: comikids_evolution_master_key_2026"')

ssh.close()
