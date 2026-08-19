import paramiko
import json
import base64
import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
    
    # 1. Consultar estado y QR
    cmd = 'curl -s -X GET "http://127.0.0.1:8080/instance/connect/comikids_whatsapp" -H "apikey: comikids_evolution_master_key_2026"'
    stdin, stdout, stderr = ssh.exec_command(cmd)
    res = stdout.read().decode('utf-8', errors='replace').strip()
    
    try:
        data = json.loads(res)
        print("[EVOLUTION RESPONSE]:")
        print(f"  - Count: {data.get('count')}")
        print(f"  - State: {data.get('state')}")
        
        base64_img = data.get("base64")
        pairing_code = data.get("pairingCode")
        code = data.get("code")
        
        if pairing_code:
            print(f"\n🔑 PAIRING CODE (Código de 8 dígitos): {pairing_code}")
            
        if base64_img:
            # Limpiar prefijo data:image/png;base64,
            clean_b64 = base64_img.replace("data:image/png;base64,", "")
            img_bytes = base64.b64decode(clean_b64)
            
            output_path = os.path.abspath("public/whatsapp_qr.png")
            with open(output_path, "wb") as f:
                f.write(img_bytes)
            print(f"\n✅ IMAGEN QR GUARDADA EN: {output_path}")
        else:
            print("\n[INFO] No vino base64 en esta llamada o WhatsApp ya está conectado o generando.")
            print("Full data:", data)
    except Exception as e:
        print("Error parseando respuesta:", e)
        print("Respuesta cruda:", res)
        
    ssh.close()

if __name__ == "__main__":
    main()
