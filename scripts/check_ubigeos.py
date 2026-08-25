import json

with open("scripts/olva_raw_agencies.json", "r", encoding="utf-8") as f:
    agencies = json.load(f)

# Let's inspect the ubigeos in olva
ubigeos = [a.get("ubigeo") for a in agencies if a.get("ubigeo")]
print("Total with ubigeo:", len(ubigeos))
print("Sample ubigeos:", ubigeos[:10])
