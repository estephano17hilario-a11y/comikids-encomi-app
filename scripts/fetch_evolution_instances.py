import urllib.request
import json

VPS_EVOLUTION_URL = "http://89.117.73.97:8080"
API_KEY = "429683C4C977415CAAFCCE10F7D57E11"

req = urllib.request.Request(f"{VPS_EVOLUTION_URL}/instance/fetchInstances", headers={
    "apikey": API_KEY,
    "Content-Type": "application/json"
})

with urllib.request.urlopen(req, timeout=5) as resp:
    instances = json.loads(resp.read().decode('utf-8'))
    print(f"[*] Total instances: {len(instances)}")
    for inst in instances:
        name = inst.get('name') or inst.get('instance', {}).get('name')
        state = inst.get('connectionStatus') or inst.get('instance', {}).get('status')
        owner = inst.get('ownerJid') or inst.get('instance', {}).get('owner')
        print(f"Name: {name} | Status: {state} | Owner: {owner}")
