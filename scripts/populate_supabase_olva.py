import urllib.request
import json
import re

with open("src/data/olvaAgencies.ts", "r", encoding="utf-8") as f:
    content = f.read()

json_match = re.search(r'export const OLVA_AGENCIES:\s*OlvaAgency\[\]\s*=\s*(\[[\s\S]*?\]);', content)
agencies = json.loads(json_match.group(1))

print(f"Total agencies to insert: {len(agencies)}")

SUPABASE_URL = "https://uwmdjsxwetjvsxsdngko.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bWRqc3h3ZXRqdnN4c2RuZ2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDE5MTEsImV4cCI6MjEwMjIxNzkxMX0.KaqryIyoe4IDQGTJD_cswZkW-wfgnMcyV9tJoWxHMq8"

headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

chunk_size = 50
total_inserted = 0

for i in range(0, len(agencies), chunk_size):
    chunk = agencies[i:i+chunk_size]
    payload = []
    for ag in chunk:
        payload.append({
            "id": ag["id"],
            "code": ag["code"],
            "name": ag["name"],
            "full_name": ag["full_name"],
            "department": ag["department"],
            "province": ag["province"],
            "district": ag["district"],
            "ubigeo": ag["ubigeo"],
            "address": ag["address"],
            "phone": ag["phone"],
            "schedule": ag["schedule"],
            "tipo": ag["tipo"],
            "is_partner": ag["is_partner"],
            "latitude": ag["latitude"],
            "longitude": ag["longitude"],
            "is_active": True
        })
        
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/olva_agencies",
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            total_inserted += len(chunk)
            print(f"[OK] Chunk {i // chunk_size + 1}: {total_inserted}/{len(agencies)} agencias insertadas en Supabase.")
    except urllib.error.HTTPError as e:
        print(f"[HTTP Error] Chunk {i // chunk_size + 1}: {e.code} - {e.read().decode('utf-8', errors='ignore')}")
    except Exception as e:
        print(f"[Error] Chunk {i // chunk_size + 1}: {e}")

print(f"SUCCESS: {total_inserted} agencias Olva guardadas en Supabase PostgreSQL.")
