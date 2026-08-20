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

req = urllib.request.Request(f"{BASE_URL}/v1/agencies?per_page=1000", headers=headers)
with urllib.request.urlopen(req, context=ctx) as r:
    data = json.loads(r.read().decode('utf-8'))
    items = data.get('items', [])
    print(f"Total agencies: {len(items)}")
    
    # Check some matches
    def find(term):
        matches = [a for a in items if term.lower() in a['nombre'].lower() or term.lower() in (a.get('direccion') or '').lower()]
        print(f"\nMatch for '{term}': ({len(matches)} found)")
        for m in matches[:3]:
            print(f"  id: {m['id']} -> {m['nombre']} ({m.get('direccion')})")

    find("MEXICO")
    find("TOCACHE")
    find("SAN MARTIN")
    find("TRUJILLO")
    find("GRAU")
