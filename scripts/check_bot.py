import paramiko, json, sys, urllib.request

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('89.117.73.97', username='root', password='estephano10FM20home')

def run(cmd):
    print(f"\n{'='*20} {cmd} {'='*20}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=10)
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    if out: print(out)
    if err: print('ERR:', err)
    return out

API_KEY = 'comikids_evolution_master_key_2026'

# 1. Configurar Webhooks con URL pública válida
instances = ['comikids_whatsapp', 'tenant_Comikids', 'tenant_matrix']
for inst in instances:
    payload = json.dumps({
        "webhook": {
            "url": "http://89.117.73.97:3000/webhook/evolution",
            "enabled": True,
            "webhookByEvents": False,
            "webhookBase64": False,
            "events": [
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
                "MESSAGES_SET",
                "SEND_MESSAGE",
                "CONNECTION_UPDATE",
                "CHATS_UPSERT",
                "CHATS_UPDATE",
                "CONTACTS_UPSERT",
                "CONTACTS_UPDATE"
            ]
        }
    })
    cmd = f'curl -s -X POST -H "apikey: {API_KEY}" -H "Content-Type: application/json" -d \'{payload}\' http://127.0.0.1:8080/webhook/set/{inst}'
    run(cmd)

# 2. Verificar estado de webhook en todas las instancias
for inst in instances:
    run(f'curl -s -H "apikey: {API_KEY}" http://127.0.0.1:8080/webhook/find/{inst}')

# 3. Simular un mensaje de prueba al webhook
test_payload = {
    "event": "messages.upsert",
    "instance": "comikids_whatsapp",
    "data": {
        "key": {
            "remoteJid": "51963097546@s.whatsapp.net",
            "fromMe": False,
            "id": f"TEST_PING_{int(sys.version_info[0])}"
        },
        "pushName": "Estephano",
        "message": {
            "conversation": "hola resumen de hoy"
        },
        "messageType": "conversation",
        "messageTimestamp": 1787422500
    }
}

req = urllib.request.Request(
    'http://89.117.73.97:3000/webhook/evolution',
    data=json.dumps(test_payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req, timeout=10) as r:
        print("\n=== TEST SIMULACION WEBHOOK ===")
        print("Status:", r.status)
        print("Response:", r.read().decode('utf-8'))
except Exception as e:
    print("Test Webhook Error:", e)

# 4. Ver logs del backend después del mensaje de prueba
run('docker logs --tail 30 backend_api')
