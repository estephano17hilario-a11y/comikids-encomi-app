import urllib.request
import json
import time
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

url = "http://89.117.73.97:3000/webhook/evolution"

print("=======================================================")
print("   [*] 1. Probando Pregunta General al Master Bot (Sin Alucinación)")
print("=======================================================")
payload1 = {
    "event": "messages.upsert",
    "instance": "comikids_whatsapp",
    "data": {
        "key": {
            "remoteJid": "51901985319@s.whatsapp.net",
            "fromMe": False,
            "id": f"TEST_QUERY_{int(time.time())}"
        },
        "pushName": "Estephano",
        "messageType": "conversation",
        "message": {
            "conversation": "Hola, cuanto es 25 + 25?"
        }
    }
}
req1 = urllib.request.Request(url, data=json.dumps(payload1).encode('utf-8'), headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req1) as r1:
    print("Ack:", r1.read().decode('utf-8'))

time.sleep(4)

print("\n=======================================================")
print("   [*] 2. Probando Acción: Ordenar a la IA Enviar un Mensaje a un Número")
print("=======================================================")
payload2 = {
    "event": "messages.upsert",
    "instance": "comikids_whatsapp",
    "data": {
        "key": {
            "remoteJid": "51901985319@s.whatsapp.net",
            "fromMe": False,
            "id": f"TEST_ACTION_{int(time.time())}"
        },
        "pushName": "Estephano",
        "messageType": "conversation",
        "message": {
            "conversation": "Por favor manda un mensaje a 963097546 diciendo: Hola Estephano, tu prueba de despacho automatico fue un exito!"
        }
    }
}
req2 = urllib.request.Request(url, data=json.dumps(payload2).encode('utf-8'), headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req2) as r2:
    print("Ack:", r2.read().decode('utf-8'))

time.sleep(5)
print("\n[+] Pruebas enviadas! Verificando logs del backend...")
