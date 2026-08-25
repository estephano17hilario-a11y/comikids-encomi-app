import urllib.request
import json
import time

API_KEY = "sk_614980da4cc14fd60bf8366e7f35bc85512f624b65ee45ff364c1a42aac15e05"

all_agencies = []
page = 1
limit = 100

while True:
    url = f"https://api.olva-api-peru.com/v1/agencias?limit={limit}&page={page}"
    print(f"Fetching page {page}...")
    req = urllib.request.Request(url, headers={
        "X-API-Key": API_KEY,
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
    })
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
            text = raw.decode('latin-1')
            data = json.loads(text)
            results = data.get("results", [])
            total = data.get("total", 0)
            
            if not results:
                break
                
            all_agencies.extend(results)
            print(f"Page {page}: retrieved {len(results)} items (Total accumulated: {len(all_agencies)}/{total})")
            
            if len(all_agencies) >= total:
                break
                
            page += 1
            time.sleep(0.3)
    except Exception as e:
        print(f"Error on page {page}:", e)
        break

print(f"\nFinal count: {len(all_agencies)} agencias Olva recuperadas.")

with open("scripts/olva_raw_agencies.json", "w", encoding="utf-8") as f:
    json.dump(all_agencies, f, indent=2, ensure_ascii=False)

print("Saved to scripts/olva_raw_agencies.json")
