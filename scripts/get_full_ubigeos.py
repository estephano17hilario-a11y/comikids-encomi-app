import urllib.request
import json

# Try fetching complete peru ubigeo dataset
urls = [
    "https://raw.githubusercontent.com/joseluisq/ubigeos-peru/master/json/ubigeo_reniec.json",
    "https://raw.githubusercontent.com/joseluisq/ubigeos-peru/master/json/ubigeo_inei.json",
    "https://raw.githubusercontent.com/ernestor/ubigeos-peru/master/distritos.json",
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"Success from {url}: {len(data)} records")
            with open("scripts/peru_ubigeos_full.json", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            break
    except Exception as e:
        print(f"Failed {url}:", e)
