import json, re

with open('src/data/shalomAgencies.ts', 'r', encoding='utf-8') as f:
    text = f.read()

deps = set(re.findall(r'"department":\s*"([^"]+)"', text))
print("Departments:", len(deps), deps)

lima_agencies = re.findall(r'\{\s*"id":\s*(\d+),[\s\S]*?"code":\s*"([^"]+)",[\s\S]*?"name":\s*"([^"]+)",[\s\S]*?"department":\s*"(?:LIMA|CALLAO)"', text)
print(f"Lima / Callao agencies count: {len(lima_agencies)}")
for a in lima_agencies[:10]:
    print("   ", a)
