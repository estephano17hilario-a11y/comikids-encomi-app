import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

API_KEY = "sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma"
BASE_URL = "https://api.shalom-api-peru.com"

req = urllib.request.Request(f"{BASE_URL}/v1/agencies?per_page=1000", headers={
    "X-API-Key": API_KEY,
    "User-Agent": "Mozilla/5.0"
})

with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    items = data.get('items') or data.get('data') or data
    print(f"[*] Total agencias en /v1/agencies: {len(items)}")
    
    # Buscar agencias en Moquegua / Mariscal Nieto / Calle Lima
    print("\n--- Agencias encontradas con 'LIMA' o 'MOQUEGUA' o 'MARISCAL' ---")
    for a in items:
        name = str(a.get('name') or a.get('nombre') or a.get('terminal') or '')
        code = str(a.get('code') or a.get('codigo') or '')
        dept = str(a.get('department') or a.get('departamento') or '')
        prov = str(a.get('province') or a.get('provincia') or '')
        dist = str(a.get('district') or a.get('distrito') or '')
        addr = str(a.get('address') or a.get('direccion') or '')
        aid = a.get('id')
        
        full_str = f"{name} {dept} {prov} {dist} {addr} {code}".upper()
        if 'MARISCAL' in full_str or 'MOQUEGUA' in full_str or 'CLLMA' in full_str:
            print(f"ID: {aid} | Code: {code} | Name: {name} | Dept: {dept} | Prov: {prov} | Dist: {dist} | Addr: {addr}")
