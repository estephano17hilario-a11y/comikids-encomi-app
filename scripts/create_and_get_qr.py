import urllib.request
import json
import base64
import os
import time

url = "http://89.117.73.97:8080/instance/create"
headers = {
    "Content-Type": "application/json",
    "apikey": "comikids_evolution_master_key_2026"
}
payload = {
    "instanceName": "comikids_whatsapp",
    "qrcode": True,
    "integration": "WHATSAPP-BAILEYS"
}

print("[*] Enviando petición de creación de instancia a Evolution API...")
req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')

try:
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode('utf-8'))
        print("\n=== INSTANCIA CREADA ===")
        print("Nombre:", res.get("instance", {}).get("instanceName"))
        print("Estado:", res.get("instance", {}).get("status"))
        
        qrcode_data = res.get("qrcode", {})
        b64 = qrcode_data.get("base64")
        code = qrcode_data.get("code")
        pairing = qrcode_data.get("pairingCode")

        if b64:
            clean_b64 = b64.replace("data:image/png;base64,", "")
            img_bytes = base64.b64decode(clean_b64)
            output_path = os.path.abspath("public/whatsapp_qr.png")
            with open(output_path, "wb") as f:
                f.write(img_bytes)
            print(f"\n🎉 EXITO: Codigo QR guardado en: {output_path}")
            
        if pairing:
            print(f"🔑 PAIRING CODE: {pairing}")
        if code:
            print(f"📌 RAW CODE: {code}")
            
except Exception as e:
    print("Error creando instancia:", e)
