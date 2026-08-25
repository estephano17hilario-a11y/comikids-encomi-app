import json
import re

# Let's read shalomAgencies.ts to extract ubigeo -> (department, province, district)
ubigeo_map = {}

with open("src/data/shalomAgencies.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Let's extract items with regex
items = re.findall(r'"ubigeo":\s*"(\d+)",\s*.*?"department":\s*"([^"]+)",\s*.*?"province":\s*"([^"]+)",\s*.*?"district":\s*"([^"]+)"', content, re.DOTALL)
for ub, dep, prov, dist in items:
    if ub not in ubigeo_map:
        ubigeo_map[ub] = (dep, prov, dist)

print(f"Extracted {len(ubigeo_map)} ubigeos from Shalom dataset.")
