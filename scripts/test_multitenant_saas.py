import paramiko
import sys
import json
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)

    print("=======================================================")
    print("   [*] 1. Probando Creación Dinámica de Tienda (Onboarding)")
    print("=======================================================")
    _, out1, _ = ssh.exec_command('curl -s -X POST http://127.0.0.1:3000/api/tenant/instance/create -H "Content-Type: application/json" -d "{\\"tenantId\\": \\"tienda_demo_saas\\"}" | jq')
    print(out1.read().decode('utf-8', errors='replace'))

    print("=======================================================")
    print("   [*] 2. Consultando Estado de la Instancia de la Tienda")
    print("=======================================================")
    _, out2, _ = ssh.exec_command('curl -s http://127.0.0.1:3000/api/tenant/instance/tienda_demo_saas/status | jq')
    print(out2.read().decode('utf-8', errors='replace'))

    print("=======================================================")
    print("   [*] 3. Simulando Webhook Multi-Tenant encolado a BullMQ")
    print("=======================================================")
    fake_webhook = {
        "event": "messages.upsert",
        "instance": "tienda_demo_saas",
        "data": {
            "key": {
                "remoteJid": "51999888777@s.whatsapp.net",
                "fromMe": False,
                "id": f"TEST_MULTI_{int(time.time())}"
            },
            "pushName": "Cliente Multi-Tenant",
            "messageType": "conversation",
            "message": {
                "conversation": "Hola, qué productos tienen disponibles?"
            }
        }
    }
    webhook_cmd = f"curl -s -X POST http://127.0.0.1:3000/webhook/evolution -H 'Content-Type: application/json' -d '{json.dumps(fake_webhook)}' | jq"
    _, out3, _ = ssh.exec_command(webhook_cmd)
    print(out3.read().decode('utf-8', errors='replace'))

    time.sleep(3)

    print("=======================================================")
    print("   [*] 4. Logs del Worker con Aislamiento por Tienda")
    print("=======================================================")
    _, out4, _ = ssh.exec_command('docker logs --tail 25 backend_api')
    print(out4.read().decode('utf-8', errors='replace'))

    print("=======================================================")
    print("   [*] 5. Limpiando Instancia de Prueba Demo")
    print("=======================================================")
    _, out5, _ = ssh.exec_command('curl -s -X DELETE http://127.0.0.1:3000/api/tenant/instance/tienda_demo_saas | jq')
    print(out5.read().decode('utf-8', errors='replace'))

    ssh.close()

if __name__ == "__main__":
    main()
