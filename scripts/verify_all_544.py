import json
import re

with open('src/data/shalom_official_agencies.json', 'r', encoding='utf-8') as f:
    official = json.load(f)

with open('src/data/shalomAgencies.ts', 'r', encoding='utf-8') as f:
    ts_content = f.read()

# Parse agencies from ts file
agency_blocks = re.findall(r'\{\s*"id":\s*(\d+),[\s\S]*?"code":\s*"([^"]+)",[\s\S]*?"name":\s*"([^"]+)",[\s\S]*?"full_name":\s*"([^"]+)",[\s\S]*?"department":\s*"([^"]+)",[\s\S]*?"province":\s*"([^"]+)",[\s\S]*?"district":\s*"([^"]+)",[\s\S]*?"address":\s*"([^"]+)"', ts_content)

dest_set = {d.upper().strip(): d for d in official['destinations']}
normalized_dest_set = {re.sub(r'[^A-Z0-9]', '', d.upper()): d for d in official['destinations']}

print(f"Total Agencias en Catálogo: {len(agency_blocks)}")

mismatches = []
for aid, code, name, full_name, dep, prov, dist, addr in agency_blocks:
    # Simular distintos formatos de texto guardados en destino_detalle
    # 1. Agencia Shalom: ANCASH / SANTA / CHIMBOTE / AV ENRIQUE MEIGGS – Av. Enrique Meiggs Nº 2457.
    # 2. ANCASH / SANTA / CHIMBOTE / AV ENRIQUE MEIGGS
    # 3. CBT - AV ENRIQUE MEIGGS
    segments = [s.strip().upper() for s in name.split('/') if s.strip()]
    last_seg = segments[-1] if segments else ''
    last_clean = re.sub(r'[()]', '', last_seg).strip()
    norm_clean = re.sub(r'[^A-Z0-9]', '', last_clean)
    
    resolved = None
    if last_clean in dest_set:
        resolved = dest_set[last_clean]
    elif norm_clean in normalized_dest_set:
        resolved = normalized_dest_set[norm_clean]
    else:
        # Buscar en lista oficial por coincidencia de subcadena
        for d in official['destinations']:
            if norm_clean and norm_clean in re.sub(r'[^A-Z0-9]', '', d.upper()):
                resolved = d
                break
                
    if not resolved:
        mismatches.append((name, last_seg))

print(f"Agencias no resueltas: {len(mismatches)}")
if mismatches:
    print("Mismatches:", mismatches[:10])
