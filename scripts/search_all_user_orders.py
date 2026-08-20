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

def search_query(q):
    print(f"\n=======================================================")
    print(f"[*] Buscando '{q}' en Shalom Pro API...")
    print("=======================================================")
    
    # 1. Probar ?search=
    url = f"{BASE_URL}/v1/orders?search={urllib.request.quote(str(q))}&limit=20"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), context=ctx) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            orders = data.get('orders', [])
            print(f"-> ?search={q} retorno {len(orders)} ordenes")
            for o in orders:
                print(f"   [MATCH] ID: {o.get('id')} | Guia: {o.get('serie')}-{o.get('guia')} | Codigo: {o.get('codigo')} | Destinatario: {o.get('receiver', {}).get('full_name')} | Doc: {o.get('receiver', {}).get('document')}")
    except Exception as e:
        print(f"-> Error: {e}")

def main():
    queries = [
        "47311650",
        "92644270",
        "Rosario",
        "Robles",
        "Carolina",
        "Tarazona",
        "7525",
        "2074"
    ]
    for q in queries:
        search_query(q)

    # Listar las ultimas 50 ordenes registradas en la cuenta
    print("\n=======================================================")
    print("[*] Ultimas 30 ordenes registradas en la cuenta:")
    print("=======================================================")
    url = f"{BASE_URL}/v1/orders?per_page=30"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), context=ctx) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        for o in data.get('orders', []):
            rec = o.get('receiver', {})
            print(f"ID: {o.get('id')} | Guia: {o.get('serie')}-{o.get('guia')} | Codigo: {o.get('codigo')} | Dest: {rec.get('full_name')} ({rec.get('document')}) | Fecha: {o.get('created_at')}")

if __name__ == '__main__':
    main()
