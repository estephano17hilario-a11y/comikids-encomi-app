import json, re

with open('src/data/shalomAgencies.ts', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'\{\s*"id":\s*449,[\s\S]*?\}', text)
if m:
    print(m.group(0))
