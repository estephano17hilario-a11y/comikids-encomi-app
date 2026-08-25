import urllib.request
import json
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

SUPABASE_URL = "https://uwmdjsxwetjvsxsdngko.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bWRqc3h3ZXRqdnN4c2RuZ2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDE5MTEsImV4cCI6MjEwMjIxNzkxMX0.KaqryIyoe4IDQGTJD_cswZkW-wfgnMcyV9tJoWxHMq8"
API_KEY = "sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma"
BASE_URL = "https://api.shalom-api-peru.com"

# 1. Obtener todas las órdenes de Shalom Pro (página 1 y 2)
shalom_orders = []
for p in [1, 2]:
    req_sh = urllib.request.Request(f"{BASE_URL}/v1/orders?per_page=100&page={p}", headers={
        "X-API-Key": API_KEY,
        "X-Shalom-Email": "milagrosjanetamis@gmail.com",
        "X-Shalom-Password": "986398Mi$",
        "User-Agent": "Mozilla/5.0"
    })
    try:
        with urllib.request.urlopen(req_sh, context=ctx, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            items = data.get('data') or data.get('orders') or []
            shalom_orders.extend(items)
    except Exception as e:
        print(f"[-] Error pagina {p}: {e}")

print(f"[*] Total ordenes cargadas de Shalom Pro: {len(shalom_orders)}")

# 2. Obtener pedidos de Supabase
req_p = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/pedidos?select=*&order=created_at.desc&limit=50", headers={
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "User-Agent": "Mozilla/5.0"
})
with urllib.request.urlopen(req_p, context=ctx, timeout=10) as resp:
    pedidos = json.loads(resp.read().decode('utf-8'))

print(f"[*] Obtenidos {len(pedidos)} pedidos de Supabase")

synced_count = 0

for p in pedidos:
    destino = p.get('destino_detalle') or ''
    m = re.search(r'(?:DNI/CE|DNI|CE|Doc|Documento)[\s:]*(?:Recojo:?\s*)?([A-Za-z0-9]{6,12})', destino, re.IGNORECASE)
    dni = m.group(1).strip() if m else ''
    
    if not dni:
        continue
    
    # Buscar en órdenes de Shalom Pro
    matched = None
    for sh in shalom_orders:
        rec = sh.get('receiver') or sh.get('destinatario') or {}
        rec_doc = str(rec.get('document') or rec.get('documento') or '').strip()
        if rec_doc == dni or (len(dni) >= 8 and rec_doc.endswith(dni)):
            matched = sh
            break
            
    if matched:
        full_guia = f"{matched.get('serie') or 'V204'}-{matched.get('guia') or matched.get('id')}"
        pin = str(matched.get('pickup_code') or '0909')
        ose_id = str(matched.get('id'))
        
        # Actualizar en Supabase
        update_url = f"{SUPABASE_URL}/rest/v1/pedidos?id=eq.{p['id']}"
        update_data = json.dumps({
            "shalom_numero_guia": full_guia,
            "shalom_clave_recojo": pin,
            "shalom_ose_id": ose_id,
            "registrado_shalom": True
        }).encode('utf-8')
        
        up_req = urllib.request.Request(update_url, data=update_data, headers={
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }, method="PATCH")
        
        try:
            with urllib.request.urlopen(up_req, context=ctx, timeout=10) as up_resp:
                print(f"[OK] {p['codigo_seguimiento']} (DNI: {dni}) -> Guia: {full_guia} | PIN: {pin} (OSE: {ose_id})")
                synced_count += 1
        except Exception as e:
            print(f"[-] Error actualizando pedido {p['id']}: {e}")

print(f"\n=== FIN: {synced_count} PEDIDOS ACTUALIZADOS CON GUIAS OFICIALES EN SUPABASE ===")
