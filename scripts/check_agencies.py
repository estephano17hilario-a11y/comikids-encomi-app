import json, re

with open('src/data/shalom_official_agencies.json', 'r', encoding='utf-8') as f:
    official = json.load(f)

with open('src/data/shalomAgencies.ts', 'r', encoding='utf-8') as f:
    ts_content = f.read()

agency_blocks = re.findall(r'\{\s*"id":\s*(\d+),[\s\S]*?"code":\s*"([^"]+)",[\s\S]*?"name":\s*"([^"]+)"', ts_content)
print(f"Total agency blocks in shalomAgencies.ts: {len(agency_blocks)}")
print(f"Total official destinations in json: {len(official['destinations'])}")

sample = agency_blocks[:5]
for s in sample:
    print("Sample agency:", s)
