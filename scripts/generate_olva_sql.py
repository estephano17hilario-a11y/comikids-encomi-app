import json
import re

with open("src/data/olvaAgencies.ts", "r", encoding="utf-8") as f:
    content = f.read()

json_match = re.search(r'export const OLVA_AGENCIES:\s*OlvaAgency\[\]\s*=\s*(\[[\s\S]*?\]);', content)
agencies = json.loads(json_match.group(1))

print(f"Total agencies to insert: {len(agencies)}")

def sql_escape(val):
    if val is None:
        return 'NULL'
    if isinstance(val, bool):
        return 'TRUE' if val else 'FALSE'
    if isinstance(val, (int, float)):
        return str(val)
    s = str(val).replace("'", "''")
    return f"'{s}'"

batches = []
batch_size = 50

for i in range(0, len(agencies), batch_size):
    chunk = agencies[i:i+batch_size]
    values = []
    for ag in chunk:
        val = f"({sql_escape(ag['id'])}, {sql_escape(ag['code'])}, {sql_escape(ag['name'])}, {sql_escape(ag['full_name'])}, {sql_escape(ag['department'])}, {sql_escape(ag['province'])}, {sql_escape(ag['district'])}, {sql_escape(ag['ubigeo'])}, {sql_escape(ag['address'])}, {sql_escape(ag['phone'])}, {sql_escape(ag['schedule'])}, {sql_escape(ag['tipo'])}, {sql_escape(ag['is_partner'])}, {sql_escape(ag['latitude'])}, {sql_escape(ag['longitude'])}, TRUE, NOW())"
        values.append(val)
    
    sql = f"""
    INSERT INTO olva_agencies (
        id, code, name, full_name, department, province, district, ubigeo, address, phone, schedule, tipo, is_partner, latitude, longitude, is_active, updated_at
    ) VALUES {', '.join(values)}
    ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        full_name = EXCLUDED.full_name,
        department = EXCLUDED.department,
        province = EXCLUDED.province,
        district = EXCLUDED.district,
        ubigeo = EXCLUDED.ubigeo,
        address = EXCLUDED.address,
        phone = EXCLUDED.phone,
        schedule = EXCLUDED.schedule,
        tipo = EXCLUDED.tipo,
        is_partner = EXCLUDED.is_partner,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    """
    batches.append(sql)

with open("scripts/olva_insert_batches.json", "w", encoding="utf-8") as f:
    json.dump(batches, f, indent=2)

print(f"Generated {len(batches)} SQL batches.")
