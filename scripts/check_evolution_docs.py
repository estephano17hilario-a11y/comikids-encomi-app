import urllib.request

VPS_EVOLUTION_URL = "http://89.117.73.97:8080"

for path in ["/", "/docs", "/swagger", "/health"]:
    req = urllib.request.Request(f"{VPS_EVOLUTION_URL}{path}", headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            print(f"[OK] {path} -> {resp.read()[:200]}")
    except Exception as e:
        print(f"[{path}] -> {e}")
