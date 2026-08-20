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
    "X-Shalom-Password": PASSWORD,
    "Content-Type": "application/json"
}

endpoints = [
    "/v1/terminals",
    "/v1/agencies",
    "/v1/destinations",
    "/v1/places",
    "/v1/products"
]

for ep in endpoints:
    req = urllib.request.Request(f"{BASE_URL}{ep}", headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx) as r:
            body = r.read().decode('utf-8')
            data = json.loads(body)
            print(f"[*] {ep} ({r.status}): {len(data) if isinstance(data, list) else list(data.keys())}")
            if isinstance(data, list) and len(data) > 0:
                print(f"    Ejemplo: {data[0]}")
    except urllib.error.HTTPError as e:
        print(f"[-] {ep} -> {e.code}: {e.read().decode('utf-8')[:100]}")
    except Exception as e:
        print(f"[-] {ep} -> {e}")
