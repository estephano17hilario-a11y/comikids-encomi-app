import urllib.request
import urllib.error
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

url = "http://89.117.73.97:3000/api/tenant/create-sub-instance"
payload = json.dumps({"tenantId": "cliente_test_qr"}).encode('utf-8')
headers = {"Content-Type": "application/json"}

req = urllib.request.Request(url, data=payload, headers=headers)

try:
    with urllib.request.urlopen(req) as resp:
        print("STATUS:", resp.status)
        print("BODY:", resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code)
    print("ERROR BODY:", e.read().decode('utf-8'))
except Exception as ex:
    print("EXCEPTION:", ex)
