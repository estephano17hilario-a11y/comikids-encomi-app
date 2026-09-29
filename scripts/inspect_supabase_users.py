import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

SUPABASE_URL = "https://api.89.117.73.97.sslip.io"
ANON_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Nzg0OTc2MCwiZXhwIjo0OTQzNTIzMzYwLCJyb2xlIjoiYW5vbiJ9._DvifLx6sViDd5UePak7xswzmT6dQp9FoQZqPnyxeRU"

# 1. Obtener los últimos 20 usuarios
url = f"{SUPABASE_URL}/rest/v1/usuarios?select=*&order=created_at.desc&limit=25"

req = urllib.request.Request(url, headers={
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "User-Agent": "Mozilla/5.0"
})

try:
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        users = json.loads(resp.read().decode('utf-8'))
        print(f"=== {len(users)} USUARIOS RECIENTES ===")
        for u in users:
            print(f"ID: {u.get('id')} | Nombre: {u.get('nombre_completo')} | DNI: {u.get('dni')} | DniDefault: {u.get('dni_default')} | Tel: {u.get('telefono_default')}")
except Exception as e:
    print(f"[-] Error: {e}")
