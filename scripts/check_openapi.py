import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

API_KEY = "sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma"
BASE_URL = "https://api.shalom-api-peru.com"

endpoints = [
    "/openapi.json",
    "/swagger.json",
    "/docs",
    "/v1/openapi.json",
    "/v1/swagger.json",
    "/v1/docs",
    "/v1/schema",
    "/v1/orders/schema"
]

for ep in endpoints:
    url = f"{BASE_URL}{ep}"
    req = urllib.request.Request(url, headers={"X-API-Key": API_KEY})
    try:
        with urllib.request.urlopen(req, context=ctx) as r:
            body = r.read().decode('utf-8')
            print(f"[*] FOUND {ep} ({r.status}): {body[:300]}")
    except urllib.error.HTTPError as e:
        print(f"[-] {ep} -> {e.code}")
    except Exception as e:
        print(f"[-] {ep} -> {e}")
