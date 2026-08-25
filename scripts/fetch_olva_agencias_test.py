import urllib.request
import json
import time

API_KEY = "sk_614980da4cc14fd60bf8366e7f35bc85512f624b65ee45ff364c1a42aac15e05"

# Let's test limit parameter or pagination
url = f"https://api.olva-api-peru.com/v1/agencias?limit=100&page=1"
req = urllib.request.Request(url, headers={
    "X-API-Key": API_KEY,
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json"
})

try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw_bytes = resp.read()
        # Decode as utf-8 or latin-1 or fix encoding
        text = raw_bytes.decode('utf-8', errors='replace')
        data = json.loads(text)
        print("Total:", data.get("total"))
        print("Page:", data.get("page"))
        print("Limit:", data.get("limit"))
        print("Count in page 1:", len(data.get("results", [])))
        if data.get("results"):
            print("First item:", json.dumps(data["results"][0], indent=2, ensure_ascii=False))
except Exception as e:
    print("Error:", e)
