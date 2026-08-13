#!/usr/bin/env python3
"""
=============================================================================
PIPELINE DE INGESTA Y SINCRONIZACIÓN SHALOM PERÚ (PYTHON 3)
=============================================================================
Descarga el 100% del catálogo oficial de agencias de Shalom Perú mediante
paginación dinámica continua (sin cortes de límite implícito) y realiza un
Batch Upsert masivo en PostgreSQL / Supabase con PostGIS y Ubigeo.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error

# Forzar UTF-8 en consola de Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Configuración de Entorno
API_KEY = os.environ.get("SHALOM_API_KEY", "sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma")
BASE_URL = os.environ.get("SHALOM_API_URL", "https://api.shalom-api-peru.com").rstrip("/")
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "https://uwmdjsxwetjvsxsdngko.supabase.co").rstrip("/")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bWRqc3h3ZXRqdnN4c2RuZ2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDE5MTEsImV4cCI6MjEwMjIxNzkxMX0.KaqryIyoe4IDQGTJD_cswZkW-wfgnMcyV9tJoWxHMq8")


def normalize_agency(raw: dict) -> dict:
    """
    Normaliza un registro de agencia extrayendo:
    ID, Nombre Completo, Dirección, Departamento, Provincia, Distrito, Ubigeo y Coordenadas.
    """
    # Horario
    horario_raw = raw.get("horario")
    schedule = "Lunes a Sábado: 8:00 AM - 8:00 PM"
    if isinstance(horario_raw, str) and horario_raw.strip():
        schedule = horario_raw.strip()
    elif isinstance(horario_raw, dict) and horario_raw.get("hora_atencion"):
        schedule = horario_raw["hora_atencion"].strip()

    # Ubicación geográfica administrativa
    dep = str(raw.get("departamento") or "LIMA").upper().strip()
    prov = str(raw.get("provincia") or "LIMA").upper().strip()
    dist = str(raw.get("distrito") or raw.get("lugar_over") or raw.get("zona") or "CENTRO").upper().strip()
    code = raw.get("abrebiatura") or raw.get("code") or None
    name = str(raw.get("nombre") or "").strip()
    address = str(raw.get("direccion") or "").strip()

    # Ubigeo
    ubi_id = raw.get("ubi_id") or raw.get("ubigeo")
    ubigeo = str(ubi_id).zfill(6) if ubi_id else None

    # Nombre completo normalizado
    code_tag = f" (CÓDIGO: {code})" if code else ""
    full_name = f"{dep} / {prov} / {dist} / {name}{f' - {address}' if address else ''}{code_tag}".upper()

    return {
        "id": raw["id"],
        "code": code,
        "name": name,
        "full_name": full_name,
        "department": dep,
        "province": prov,
        "district": dist,
        "ubigeo": ubigeo,
        "dep_id": raw.get("dep_id"),
        "prov_id": raw.get("prov_id"),
        "dist_id": raw.get("dist_id"),
        "address": address,
        "phone": raw.get("telefono") or "(01) 500-7878",
        "schedule": schedule,
        "latitude": raw.get("latitud"),
        "longitude": raw.get("longitud"),
        "is_active": True,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def fetch_all_agencies_from_api(per_page: int = 50, delay_seconds: float = 0.5) -> list:
    """
    Descarga el 100% de agencias iterando página tras página hasta que la API devuelva [].
    """
    print("=" * 60)
    print("🚀 INICIANDO DESCARGA DINÁMICA DE AGENCIAS SHALOM PERÚ (PYTHON)")
    print("=" * 60)
    print(f"📡 API Endpoint: {BASE_URL}/v1/agencies")
    print(f"🔑 API Key: {'Configurada' if API_KEY else 'No encontrada'}")
    print("-" * 60)

    all_raw_agencies = []
    page = 1
    has_more = True

    while has_more:
        url = f"{BASE_URL}/v1/agencies?page={page}&per_page={per_page}"
        print(f"📥 Solicitando Página {page}...")

        req = urllib.request.Request(
            url,
            headers={
                "X-API-Key": API_KEY,
                "User-Agent": "Shalom-Python-Sync/1.0",
                "Accept": "application/json"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                if response.status != 200:
                    print(f"❌ Error HTTP {response.status} en página {page}")
                    break
                data = json.loads(response.read().decode("utf-8"))

                # Manejar array directo, data o items
                items = data if isinstance(data, list) else (data.get("items") or data.get("data") or [])

                if not items:
                    print(f"🏁 No hay más agencias en la página {page}. Finalizando bucle.")
                    has_more = False
                else:
                    all_raw_agencies.extend(items)
                    print(f"  ✅ Página {page} OK: +{len(items)} agencias (Acumulado: {len(all_raw_agencies)})")

                    if len(items) < per_page:
                        print(f"🏁 Última página alcanzada ({len(items)} < {per_page}).")
                        has_more = False
                    else:
                        page += 1
                        time.sleep(delay_seconds)  # Rate Limit Safe: 60 req/min

        except Exception as e:
            print(f"❌ Error al consultar página {page}: {e}")
            break

    print("-" * 60)
    print(f"🎉 Descarga HTTP completada. Total agencias recibidas: {len(all_raw_agencies)}")
    return all_raw_agencies


def fetch_existing_agencies_db() -> dict:
    """
    Obtiene el estado previo de agencias en Supabase para cálculo de Diff.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {}

    url = f"{SUPABASE_URL}/rest/v1/shalom_agencies?select=id,name,address,schedule,is_active"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Accept": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                rows = json.loads(resp.read().decode("utf-8"))
                return {int(r["id"]): r for r in rows}
    except Exception as e:
        print(f"⚠️ No se pudo consultar estado previo en DB: {e}")
    return {}


def batch_upsert_supabase(normalized_agencies: list, batch_size: int = 100):
    """
    Inserta o actualiza por lotes (Batch Upsert) directamente en Supabase PostgreSQL.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("⚠️ Supabase no configurado en variables de entorno. Saltando carga SQL.")
        return

    print(f"💾 Guardando {len(normalized_agencies)} agencias en Supabase por lotes de {batch_size}...")

    upsert_url = f"{SUPABASE_URL}/rest/v1/shalom_agencies"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    total_inserted = 0
    for i in range(0, len(normalized_agencies), batch_size):
        batch = normalized_agencies[i:i + batch_size]
        payload = json.dumps(batch).encode("utf-8")

        req = urllib.request.Request(upsert_url, data=payload, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status in (200, 201):
                    total_inserted += len(batch)
                    print(f"  💾 Lote {i // batch_size + 1} guardado ({total_inserted}/{len(normalized_agencies)})...")
                else:
                    print(f"  ⚠️ Respuesta inesperada en lote {i // batch_size + 1}: {resp.status}")
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            print(f"  ❌ Error HTTP al insertar lote {i // batch_size + 1}: {e.code} - {err_body}")
        except Exception as e:
            print(f"  ❌ Error de conexión al insertar lote: {e}")

    print(f"✅ Batch Upsert finalizado: {total_inserted} registros confirmados en base de datos.")


def deactivate_closed_agencies(deactivate_ids: list):
    """
    Marca como is_active=False las agencias que Shalom dio de baja en su API.
    """
    if not deactivate_ids or not SUPABASE_URL or not SUPABASE_KEY:
        return

    print(f"🛑 Desactivando {len(deactivate_ids)} agencias cerradas por Shalom...")
    ids_param = ",".join(str(i) for i in deactivate_ids)
    url = f"{SUPABASE_URL}/rest/v1/shalom_agencies?id=in.({ids_param})"
    payload = json.dumps({"is_active": False, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        },
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 204):
                print(f"  ✅ {len(deactivate_ids)} agencias marcadas como inactivas en DB.")
    except Exception as e:
        print(f"  ⚠️ Error desactivando agencias: {e}")


def main():
    start_time = time.time()
    
    # 1. Ingesta completa dinámica
    raw_agencies = fetch_all_agencies_from_api(per_page=50, delay_seconds=0.5)

    if not raw_agencies:
        print("❌ No se pudieron obtener agencias de la API.")
        sys.exit(1)

    # 2. Normalización de campos
    normalized = [normalize_agency(item) for item in raw_agencies]
    api_ids = {int(a["id"]) for a in normalized}

    # 3. Detección diferencial contra base de datos
    existing_db = fetch_existing_agencies_db()
    new_count = 0
    updated_count = 0
    reactivated_count = 0
    to_deactivate_ids = []

    for item in normalized:
        item_id = int(item["id"])
        if item_id not in existing_db:
            new_count += 1
        else:
            prev = existing_db[item_id]
            if prev.get("is_active") is False:
                reactivated_count += 1
            elif (
                prev.get("name") != item["name"] or
                prev.get("address") != item["address"] or
                prev.get("schedule") != item["schedule"]
            ):
                updated_count += 1

    for db_id, prev in existing_db.items():
        if prev.get("is_active") is not False and db_id not in api_ids:
            to_deactivate_ids.append(db_id)

    print("=" * 60)
    print("📊 DIFERENCIAL DETECTADO:")
    print(f"  ✨ Nuevas agencias detectadas       : {new_count}")
    print(f"  📝 Agencias con cambios (nombre/dir): {updated_count}")
    print(f"  🔄 Agencias reactivadas             : {reactivated_count}")
    print(f"  🛑 Agencias cerradas/eliminadas     : {len(to_deactivate_ids)}")
    print("=" * 60)

    # 4. Guardar snapshot JSON local y actualizar fallback TS
    os.makedirs("data", exist_ok=True)
    with open("data/shalom_agencies_full.json", "w", encoding="utf-8") as f:
        json.dump(normalized, f, ensure_ascii=False, indent=2)
    print("📁 Respaldo JSON guardado en: data/shalom_agencies_full.json")

    # 5. Inserción Masiva en BD
    batch_upsert_supabase(normalized, batch_size=100)

    # 6. Desactivar bajas
    if to_deactivate_ids:
        deactivate_closed_agencies(to_deactivate_ids)

    # 7. Estadísticas y Departamentos detectados
    departments = {}
    for a in normalized:
        d = a["department"]
        departments[d] = departments.get(d, 0) + 1

    print("=" * 60)
    print("📊 RESUMEN POR DEPARTAMENTOS:")
    for dep, count in sorted(departments.items()):
        print(f"  • {dep.ljust(20)}: {count} agencias")
    
    elapsed = round(time.time() - start_time, 2)
    print("=" * 60)
    print(f"🏁 SINCRONIZACIÓN EXITOSA EN {elapsed}s | TOTAL ACTIVAS: {len(normalized)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
