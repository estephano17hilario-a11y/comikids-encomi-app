import json

with open("scripts/olva_raw_agencies.json", "r", encoding="utf-8") as f:
    agencies = json.load(f)

print(f"Total: {len(agencies)}")

departments = set()
types = set()
inverted_coords = 0
valid_coords = 0

for ag in agencies:
    departments.add(ag.get("departamento"))
    types.add(ag.get("tipo"))
    
    lat_str = ag.get("lat")
    lng_str = ag.get("lng")
    if lat_str and lng_str:
        try:
            lat = float(lat_str)
            lng = float(lng_str)
            
            # In Peru, latitude is roughly -0.03 to -18.35, longitude is roughly -68.65 to -81.33
            if lng < -1 and lng > -20 and lat < -65 and lat > -85:
                # Inverted!
                inverted_coords += 1
            else:
                valid_coords += 1
        except:
            pass

print("Departments found:", sorted(list(departments)))
print("Agency Types found:", sorted(list(types)))
print(f"Coordinates: {valid_coords} standard, {inverted_coords} inverted (auto-fixable)")
