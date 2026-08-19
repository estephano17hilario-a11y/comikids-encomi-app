import paramiko
import json
import base64
import time
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
    stdin, stdout, stderr = ssh.exec_command('curl -s -X DELETE "http://127.0.0.1:8080/instance/delete/comikids_whatsapp" -H "apikey: comikids_evolution_master_key_2026"')
    print("DELETE:", stdout.read().decode('utf-8'))

    time.sleep(3)

    # 2. Crear nueva instancia comikids_whatsapp
    create_cmd = """curl -s -X POST "http://127.0.0.1:8080/instance/create" \\
  -H "Content-Type: application/json" \\
  -H "apikey: comikids_evolution_master_key_2026" \\
  -d '{
    "instanceName": "comikids_whatsapp",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'"""
    stdin, stdout, stderr = ssh.exec_command(create_cmd)
    create_res = stdout.read().decode('utf-8')
    print("CREATE:", create_res)

    try:
        data = json.loads(create_res)
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
            print(f"\n🎉 EXITO: QR CREADO Y GUARDADO EN: {output_path}")
        if pairing:
            print("🔑 PAIRING CODE:", pairing)
        if code:
            print("📌 CODE:", code[:60])
    except Exception as e:
        print("Error:", e)

    ssh.close()

if __name__ == "__main__":
    main()
