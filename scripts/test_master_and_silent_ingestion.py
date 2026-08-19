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
    print("   [*] 1. Probando Creación de Sub-Instancia / Sub-QR")
    print("=======================================================")
    _, out1, _ = ssh.exec_command('curl -s -X POST http://127.0.0.1:3000/api/tenant/create-sub-instance -H "Content-Type: application/json" -d "{\\"tenantId\\": \\"cliente_vip_101\\"}" | jq')
    print(out1.read().decode('utf-8', errors='replace'))

    print("=======================================================")
    print("   [*] 2. Ingesta Silenciosa en Sub-Instancia (Sin Auto-Reply)")
    print("=======================================================")
    fake_sub_webhook = {
        "event": "messages.upsert",
        "instance": "tenant_cliente_vip_101",
        "data": {
            "key": {
                "remoteJid": "51988776655@s.whatsapp.net",
                "fromMe": False,
                "id": f"SUB_MSG_{int(time.time())}"
            },
            "pushName": "Comprador Juan",
            "messageType": "conversation",
            "message": {
                "conversation": "Hola, ya te transferí los 150 soles por BCP."
            }
        }
    }
    _, out2, _ = ssh.exec_command(f"curl -s -X POST http://127.0.0.1:3000/webhook/evolution -H 'Content-Type: application/json' -d '{json.dumps(fake_sub_webhook)}' | jq")
    print(out2.read().decode('utf-8', errors='replace'))

    time.sleep(3)

    print("=======================================================")
    print("   [*] 3. Consulta Interactiva al Master Bot (Copiloto)")
    print("=======================================================")
    fake_master_webhook = {
        "event": "messages.upsert",
        "instance": "main_bot",
        "data": {
            "key": {
                "remoteJid": "51901985319@s.whatsapp.net",
                "fromMe": False,
                "id": f"MASTER_QUERY_{int(time.time())}"
            },
            "pushName": "Estephano (Dueño)",
            "messageType": "conversation",
            "message": {
                "conversation": "¿Qué transferencias y conversaciones recientes tenemos registradas en el sistema?"
            }
        }
    }
    _, out3, _ = ssh.exec_command(f"curl -s -X POST http://127.0.0.1:3000/webhook/evolution -H 'Content-Type: application/json' -d '{json.dumps(fake_master_webhook)}' | jq")
    print(out3.read().decode('utf-8', errors='replace'))

    time.sleep(5)

    print("=======================================================")
    print("   [*] 4. Logs de los Workers (Ingesta Silenciosa vs Copilot Master)")
    print("=======================================================")
    _, out4, _ = ssh.exec_command('docker logs --tail 35 backend_api')
    print(out4.read().decode('utf-8', errors='replace'))

    # Limpiar sub-instancia de test
    ssh.exec_command('curl -s -X DELETE http://127.0.0.1:3000/api/tenant/tenant_cliente_vip_101')

    ssh.close()

if __name__ == "__main__":
    main()
