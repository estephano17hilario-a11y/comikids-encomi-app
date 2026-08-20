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

# 1. Inspect Products
req = urllib.request.Request(f"{BASE_URL}/v1/products", headers=headers)
with urllib.request.urlopen(req, context=ctx) as r:
    print("Products:", r.read().decode('utf-8'))

# 2. Inspect Agencies
req = urllib.request.Request(f"{BASE_URL}/v1/agencies?per_page=10", headers=headers)
with urllib.request.urlopen(req, context=ctx) as r:
    print("\nAgencies sample:", r.read().decode('utf-8')[:600])
