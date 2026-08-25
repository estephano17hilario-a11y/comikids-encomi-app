import urllib.request
import json

VPS_EVOLUTION_URL = "http://89.117.73.97:8080"
# Global API key from docker-compose is "clave_global_evolution_segura"

for key in ["clave_global_evolution_segura", "429683C4C977415CAAFCCE10F7D57E11"]:
    req = urllib.request.Request(f"{VPS_EVOLUTION_URL}/instance/fetchInstances", headers={
        "apikey": key,
        "Content-Type": "application/json"
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"[OK with key {key}] Total instances: {len(data)}")
            for inst in data:
                print(f" - Name: {inst.get('name') or inst.get('instance', {}).get('name')} | Status: {inst.get('connectionStatus') or inst.get('instance', {}).get('status')}")
            break
    except Exception as e:
        print(f"Error with key {key}:", e)
