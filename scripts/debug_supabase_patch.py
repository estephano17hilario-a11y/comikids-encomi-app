import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

SUPABASE_URL = "https://uwmdjsxwetjvsxsdngko.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bWRqc3h3ZXRqdnN4c2RuZ2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDE5MTEsImV4cCI6MjEwMjIxNzkxMX0.KaqryIyoe4IDQGTJD_cswZkW-wfgnMcyV9tJoWxHMq8"

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
