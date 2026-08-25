import urllib.request
import urllib.error
import json

API_KEY = "sk_614980da4cc14fd60bf8366e7f35bc85512f624b65ee45ff364c1a42aac15e05"

urls = [
    # apiperu.dev (POST or GET)
    ("https://apiperu.dev/api/dni/47311650", "GET"),
    ("https://apiperu.dev/api/ruc/20512528458", "GET"),
    ("https://apiperu.dev/api/ubigeo", "POST"),
    ("https://apiperu.dev/api/agencias/olva", "GET"),
    ("https://apiperu.dev/api/olva", "GET"),

    # api.shalom-api-peru.com
    ("https://api.shalom-api-peru.com/v1/agencies", "GET"),
    ("https://api.shalom-api-peru.com/v1/orders", "GET"),
    ("https://api.shalom-api-peru.com/v1/departments", "GET"),
    
    # apisperu.com / apisperu.net / decodex / peru-consultas / apis.net.pe
    ("https://api.apisperu.com/v1/dni/47311650", "GET"),
    ("https://api.apis.net.pe/v2/reniec/dni?numero=47311650", "GET"),
    ("https://api.apis.net.pe/v1/dni?numero=47311650", "GET"),
    ("https://api.apis.net.pe/v2/sunat/ruc?numero=20512528458", "GET"),
    
    # courier apis
    ("https://api.shalom.pe/v1/agencias", "GET"),
    ("https://api.shalom.pe/v1/destinos", "GET"),
    ("https://rastrea.shalom.pe/api/agencias", "GET"),
    ("https://api.olvacourier.com/api/agencias", "GET"),
    ("https://tracking.olvacourier.com/api/agencias", "GET"),
    ("https://intranet.olvacourier.com/api/agencias", "GET"),
    ("https://servicios.olva.com.pe/api/agencias", "GET"),
    ("https://olvaexpress.pe/api/agencias", "GET"),
    ("https://olvacourier.com/wp-json/wp/v2/agencias", "GET"),
    ("https://olvacourier.com/agencias", "GET"),
]

for url, method in urls:
    for header in [
        {"Authorization": f"Bearer {API_KEY}"},
        {"X-API-Key": API_KEY},
        {"api-key": API_KEY},
        {"x-api-token": API_KEY},
    ]:
        try:
            req = urllib.request.Request(url, headers={**header, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}, method=method)
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = resp.read().decode('utf-8', errors='ignore')
                print(f"[SUCCESS {resp.status}] {url} header: {list(header.keys())[0]} => {data[:300]}")
                break
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='ignore')
            if e.code not in [404, 401, 403, 502, 503]:
                print(f"[HTTP {e.code}] {url} => {body[:150]}")
            elif e.code in [400, 422]:
                print(f"[HTTP {e.code}] {url} => {body[:150]}")
        except Exception:
            pass
