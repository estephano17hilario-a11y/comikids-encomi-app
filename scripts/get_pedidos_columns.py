import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

SUPABASE_URL = "https://api.89.117.73.97.sslip.io"
ANON_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Nzg0OTc2MCwiZXhwIjo0OTQzNTIzMzYwLCJyb2xlIjoiYW5vbiJ9._DvifLx6sViDd5UePak7xswzmT6dQp9FoQZqPnyxeRU"

url = f"{SUPABASE_URL}/rest/v1/pedidos?limit=1"
req = urllib.request.Request(url, headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}", "User-Agent": "Mozilla/5.0"})

with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    if data:
        print("COLUMNS IN PEDIDOS:")
        for k in data[0].keys():
            print(f"- {k}: {data[0][k]}")
