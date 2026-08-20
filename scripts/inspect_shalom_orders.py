import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

EMAIL = "milagrosjanetamis@gmail.com"
PASSWORD = "986398Mi$"
API_KEY = "sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma"
BASE_URL = "https://api.shalom-api-peru.com"

headers = {
    "X-API-Key": API_KEY,
    "X-Shalom-Email": EMAIL,
    "X-Shalom-Password": PASSWORD
}

def main():
    req_obj = urllib.request.Request(f"{BASE_URL}/v1/orders?per_page=10", headers=headers)
    with urllib.request.urlopen(req_obj, context=ctx) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print("TOTAL ORDENES ENCONTRADAS:", len(data.get('orders', [])))
        for o in data.get('orders', [])[:5]:
            print("\n--- ORDEN ---")
            print(json.dumps(o, indent=2, ensure_ascii=False))
            order_id = o.get('id')
            # Probar descargar label
            label_req = urllib.request.Request(f"{BASE_URL}/v1/orders/{order_id}/label", headers=headers)
            try:
                with urllib.request.urlopen(label_req, context=ctx) as lresp:
                    pdf_bytes = lresp.read()
                    print(f"[*] PDF Oficial para orden {order_id}: {len(pdf_bytes)} bytes descargados!")
            except Exception as le:
                print(f"[-] Error descargando label para {order_id}: {le}")

if __name__ == '__main__':
    main()
