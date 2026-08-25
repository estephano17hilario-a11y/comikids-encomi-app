import urllib.request
import json

req = urllib.request.Request("http://89.117.73.97:3000/api/tenant/instances")
try:
    with urllib.request.urlopen(req, timeout=5) as resp:
        print("Status:", resp.status)
        data = json.loads(resp.read().decode('utf-8'))
        print("Backend instances response:", json.dumps(data, indent=2))
except Exception as e:
    print("Error:", e)
