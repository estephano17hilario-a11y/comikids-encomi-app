import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

API_KEY = "sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma"
BASE_URL = "https://api.shalom-api-peru.com"

# 1. Obtener primera página y meta
url = f"{BASE_URL}/v1/orders?per_page=100&page=1"
req = urllib.request.Request(url, headers={
    "X-API-Key": API_KEY,
    "X-Shalom-Email": "milagrosjanetamis@gmail.com",
    "X-Shalom-Password": "986398Mi$",
    "User-Agent": "Mozilla/5.0"
})

try:
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        body = resp.read().decode('utf-8')
        data = json.loads(body)
        print("[*] Meta:", json.dumps(data.get('meta'), indent=2))
        last_page = data.get('meta', {}).get('last_page', 1)
        print(f"[*] Last page is: {last_page}")

        # 2. Descargar la ÚLTIMA página (las órdenes más recientes de HOY)
        url_last = f"{BASE_URL}/v1/orders?per_page=100&page={last_page}"
        req_last = urllib.request.Request(url_last, headers={
            "X-API-Key": API_KEY,
            "X-Shalom-Email": "milagrosjanetamis@gmail.com",
            "X-Shalom-Password": "986398Mi$",
            "User-Agent": "Mozilla/5.0"
        })
        with urllib.request.urlopen(req_last, context=ctx, timeout=15) as resp_last:
            data_last = json.loads(resp_last.read().decode('utf-8'))
            orders_last = data_last.get('data') or data_last.get('orders') or []
            print(f"\n--- ÓRDENES DE LA ÚLTIMA PÁGINA ({len(orders_last)} órdenes) ---")
            for o in orders_last[-25:]:
                oid = o.get('id')
                serie = o.get('serie')
                guia = o.get('guia')
                created_at = o.get('created_at') or o.get('date') or o.get('fecha')
                receiver = o.get('receiver') or o.get('destinatario') or {}
                rec_doc = receiver.get('document') or receiver.get('documento')
                rec_name = f"{receiver.get('name') or ''} {receiver.get('last_name') or ''}".strip()
                dest = o.get('destination_agency') or o.get('destino') or {}
                dest_name = dest.get('name') if isinstance(dest, dict) else dest
                print(f"ID: {oid} | Guía: {serie}-{guia} | Fecha: {created_at} | DNI: {rec_doc} | Nombre: {rec_name} | Destino: {dest_name}")
except Exception as e:
    print(f"[-] Error: {e}")
