import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

SUPABASE_URL = "https://api.89.117.73.97.sslip.io"
ANON_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Nzg0OTc2MCwiZXhwIjo0OTQzNTIzMzYwLCJyb2xlIjoiYW5vbiJ9._DvifLx6sViDd5UePak7xswzmT6dQp9FoQZqPnyxeRU"

update_url = f"{SUPABASE_URL}/rest/v1/pedidos?id=eq.ped-mt7zmc3ysmd9"
update_data = json.dumps({
    "shalom_numero_guia": "V204-93223686",
    "shalom_clave_recojo": "0909"
}).encode('utf-8')

up_req = urllib.request.Request(update_url, data=update_data, headers={
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json"
}, method="PATCH")

try:
    with urllib.request.urlopen(up_req, context=ctx, timeout=10) as resp:
        print("Status:", resp.status)
        print("Response:", resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Body:", e.read().decode('utf-8'))
except Exception as err:
    print("Err:", err)
