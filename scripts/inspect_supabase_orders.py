import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

SUPABASE_URL = "https://uwmdjsxwetjvsxsdngko.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bWRqc3h3ZXRqdnN4c2RuZ2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDE5MTEsImV4cCI6MjEwMjIxNzkxMX0.KaqryIyoe4IDQGTJD_cswZkW-wfgnMcyV9tJoWxHMq8"

# 1. Obtener los últimos 25 pedidos de Supabase
url = f"{SUPABASE_URL}/rest/v1/pedidos?select=*&order=created_at.desc&limit=25"

req = urllib.request.Request(url, headers={
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "User-Agent": "Mozilla/5.0"
})

try:
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        pedidos = json.loads(resp.read().decode('utf-8'))
        print(f"=== {len(pedidos)} PEDIDOS RECIENTES EN SUPABASE ===")
        for p in pedidos:
            pid = p.get('id')
            codigo = p.get('codigo_seguimiento')
            destino = p.get('destino_detalle')
            guia = p.get('shalom_numero_guia')
            estado = p.get('estado_envio')
            uid = p.get('usuario_id')
            obs = p.get('observaciones_cliente') or ''
            print(f"ID: {pid} | Codigo: {codigo} | Estado: {estado} | UserID: {uid} | Guia: {guia} | Destino: {destino} | Obs: {obs}")
except Exception as e:
    print(f"[-] Error: {e}")
