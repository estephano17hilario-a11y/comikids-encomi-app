import json
import re

with open('src/data/shalom_official_agencies.json', 'r', encoding='utf-8') as f:
    official = json.load(f)

with open('src/data/shalomAgencies.ts', 'r', encoding='utf-8') as f:
    ts_content = f.read()

agency_blocks = re.findall(r'\{\s*"id":\s*(\d+),[\s\S]*?"code":\s*"([^"]+)",[\s\S]*?"name":\s*"([^"]+)",[\s\S]*?"full_name":\s*"([^"]+)",[\s\S]*?"department":\s*"([^"]+)",[\s\S]*?"province":\s*"([^"]+)",[\s\S]*?"district":\s*"([^"]+)",[\s\S]*?"address":\s*"([^"]+)"', ts_content)

dest_set = {d.upper().strip(): d for d in official['destinations']}
normalized_dest_set = {re.sub(r'[^A-Z0-9]', '', d.upper()): d for d in official['destinations']}

exact_map = {}

for aid, code, name, full_name, dep, prov, dist, addr in agency_blocks:
    segments = [s.strip().upper() for s in name.split('/') if s.strip()]
    last_seg = segments[-1] if segments else ''
    last_clean = re.sub(r'[()]', '', last_seg).strip()
    norm_last = re.sub(r'[^A-Z0-9]', '', last_clean)
    
    # Intentar resolver
    match = None
    if last_seg in dest_set:
        match = dest_set[last_seg]
    elif last_clean in dest_set:
        match = dest_set[last_clean]
    elif norm_last in normalized_dest_set:
        match = normalized_dest_set[norm_last]
    else:
        # Búsqueda por subcadena
        for d in official['destinations']:
            norm_d = re.sub(r'[^A-Z0-9]', '', d.upper())
            if norm_last and (norm_last == norm_d or norm_last in norm_d or norm_d in norm_last):
                match = d
                break
        
        # Búsqueda por código si existe
        if not match:
            for d in official['destinations']:
                if code.upper() in d.upper():
                    match = d
                    break

        # Fallback al distrito
        if not match and len(segments) >= 2:
            dist_seg = segments[-2]
            dist_clean = re.sub(r'[()]', '', dist_seg).strip()
            norm_dist = re.sub(r'[^A-Z0-9]', '', dist_clean)
            if dist_clean in dest_set:
                match = dest_set[dist_clean]
            elif norm_dist in normalized_dest_set:
                match = normalized_dest_set[norm_dist]

        # Fallback a provincia
        if not match and len(segments) >= 3:
            prov_seg = segments[1].strip()
            if prov_seg in dest_set:
                match = dest_set[prov_seg]

    if not match:
        match = official['destinations'][0]

    exact_map[code.upper().strip()] = match
    exact_map[name.upper().strip()] = match
    # También clave normalizada de la ruta completa
    exact_map[re.sub(r'[^A-Z0-9]', '', name.upper())] = match

print(f"Total Claves en exact_map: {len(exact_map)}")
print("Ejemplo CBT (Enrique Meiggs):", exact_map.get('CBT'))
print("Ejemplo SRA (Santa):", exact_map.get('SRA'))
print("Ejemplo AVGAL (Jose Galvez):", exact_map.get('AVGAL'))
