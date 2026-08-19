import paramiko
import json
import base64
import os
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
    
    # 1. Eliminar instancia anterior
    ssh.exec_command('curl -s -X DELETE "http://127.0.0.1:8080/instance/delete/comikids_whatsapp" -H "apikey: comikids_evolution_master_key_2026"')
    
    # 2. Crear nueva instancia
    cmd = """curl -s -X POST "http://127.0.0.1:8080/instance/create" \\
  -H "Content-Type: application/json" \\
  -H "apikey: comikids_evolution_master_key_2026" \\
  -d '{
    "instanceName": "comikids_whatsapp",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'"""
    stdin, stdout, stderr = ssh.exec_command(cmd)
    res = stdout.read().decode('utf-8', errors='replace').strip()
    
    try:
        data = json.loads(res)
        print("CREATE RESPONSE:")
        print("Instance:", data.get("instance", {}).get("instanceName"))
        
        qrcode = data.get("qrcode", {})
        b64 = qrcode.get("base64")
        code = qrcode.get("code")
        pairing = qrcode.get("pairingCode")
        
        if b64:
            clean_b64 = b64.replace("data:image/png;base64,", "")
            img_bytes = base64.b64decode(clean_b64)
            output_path = os.path.abspath("public/whatsapp_qr.png")
            with open(output_path, "wb") as f:
                f.write(img_bytes)
            print(f"\n✅ IMAGEN QR GUARDADA EN: {output_path}")
            
        if pairing:
            print(f"🔑 PAIRING CODE: {pairing}")
            
        if code:
            print(f"📌 RAW CODE: {code[:80]}...")
            
    except Exception as e:
        print("RAW RESPONSE:", res)
        
    ssh.close()

if __name__ == "__main__":
    main()
