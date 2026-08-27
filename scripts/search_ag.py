import json, re

with open('src/data/shalomAgencies.ts', 'r', encoding='utf-8') as f:
    text = f.read()

def search_text(pattern):
    blocks = re.findall(r'(\{\s*"id":\s*\d+,[\s\S]*?"code":\s*"[^"]+",[\s\S]*?"name":\s*"[^"]*"[\s\S]*?\})', text)
    print(f"\n--- Search results for: {pattern} ---")
    for b in blocks:
        if pattern.upper() in b.upper():
            aid = re.search(r'"id":\s*(\d+)', b)
            code = re.search(r'"code":\s*"([^"]+)"', b)
            name = re.search(r'"name":\s*"([^"]+)"', b)
            print(f"ID: {aid.group(1) if aid else '?'}, Code: {code.group(1) if code else '?'}, Name: {name.group(1) if name else '?'}")

search_text("EJERCITO")
search_text("TINGO MAR")
search_text("PROGRESO")
