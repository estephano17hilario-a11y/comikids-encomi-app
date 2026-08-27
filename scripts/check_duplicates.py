import json, re

with open('src/data/shalom_official_agencies.json', 'r', encoding='utf-8') as f:
    official = json.load(f)

with open('src/data/shalomAgencies.ts', 'r', encoding='utf-8') as f:
    ts_content = f.read()

agency_blocks = re.findall(r'\{\s*"id":\s*(\d+),[\s\S]*?"code":\s*"([^"]+)",[\s\S]*?"name":\s*"([^"]+)",[\s\S]*?"full_name":\s*"([^"]+)",[\s\S]*?"department":\s*"([^"]+)",[\s\S]*?"province":\s*"([^"]+)",[\s\S]*?"district":\s*"([^"]+)",[\s\S]*?"address":\s*"([^"]+)"', ts_content)

print(f"Total agencies: {len(agency_blocks)}")

# Check duplicate codes or IDs
ids = [int(a[0]) for a in agency_blocks]
codes = [a[1].upper().strip() for a in agency_blocks]
print(f"Unique IDs: {len(set(ids))}")
print(f"Unique codes: {len(set(codes))}")

# Check any with same code
from collections import Counter
c = Counter(codes)
for code, count in c.items():
    if count > 1:
        print(f"Duplicate code: {code} (count {count})")
        matching = [a for a in agency_blocks if a[1].upper().strip() == code]
        for m in matching:
            print(f"   ID: {m[0]}, Name: {m[2]}")
