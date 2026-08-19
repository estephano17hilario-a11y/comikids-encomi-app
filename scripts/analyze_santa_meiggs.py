import json
import re

with open('src/data/shalom_official_agencies.json', 'r', encoding='utf-8') as f:
    official = json.load(f)

with open('src/data/shalomAgencies.ts', 'r', encoding='utf-8') as f:
    ts_content = f.read()

# Buscar agencias en Ancash / Santa / Chimbote
print("--- BUSCANDO EN TS (SHALOM AGENCIES) ---")
matches_ts = re.findall(r'\{\s*"id":\s*(\d+),[\s\S]*?"code":\s*"([^"]+)",[\s\S]*?"name":\s*"([^"]+)",[\s\S]*?"full_name":\s*"([^"]+)",[\s\S]*?"department":\s*"([^"]+)",[\s\S]*?"province":\s*"([^"]+)",[\s\S]*?"district":\s*"([^"]+)",[\s\S]*?"address":\s*"([^"]+)"', ts_content)

for aid, code, name, full_name, dep, prov, dist, addr in matches_ts:
    if 'SANTA' in dep.upper() or 'SANTA' in prov.upper() or 'SANTA' in dist.upper() or 'MEIGGS' in addr.upper() or 'CHIMBOTE' in prov.upper():
        print(f"TS ID: {aid} | Code: {code} | Name: {name} | Dep: {dep} | Prov: {prov} | Dist: {dist} | Addr: {addr}")

print("\n--- BUSCANDO EN EXCEL OFICIAL DESTINOS ---")
for d in official['destinations']:
    if 'SANTA' in d.upper() or 'CHIMBOTE' in d.upper() or 'MEIGGS' in d.upper() or 'ENRIQUE' in d.upper() or 'ANCASH' in d.upper():
        print("Excel Destino:", d)
