import urllib.request
import urllib.error
import json

API_KEY = "sk_614980da4cc14fd60bf8366e7f35bc85512f624b65ee45ff364c1a42aac15e05"

urls_to_test = [
    # Shalom API Peru domain / possible olva endpoints or general courier endpoints
    ("https://api.shalom-api-peru.com/v1/agencies", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/olva/agencies", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/olva", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/couriers", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/places", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/destinations", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/ubigeo", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/departments", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/provinces", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/districts", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/me", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/user", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/profile", "GET", {}),
    ("https://api.shalom-api-peru.com/v1/orders", "GET", {}),
    
    # Other Olva API possibilities
    ("https://api.olva.com.pe/v1/agencies", "GET", {}),
    ("https://api.olvaexpress.pe/v1/agencies", "GET", {}),
    ("https://api.olvacourier.com/v1/agencies", "GET", {}),
    ("https://api-peru.com/api/olva/agencies", "GET", {}),
    ("https://apiperu.dev/api/olva/agencies", "GET", {}),
    ("https://apiperu.dev/api/agencies", "GET", {}),
    ("https://apiperu.dev/api/ubigeos", "GET", {}),
]

for url, method, body in urls_to_test:
    for header_mode in [
        {"X-API-Key": API_KEY},
        {"Authorization": f"Bearer {API_KEY}"},
        {"api-key": API_KEY},
    ]:
        try:
            req = urllib.request.Request(url, headers=header_mode, method=method)
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = resp.read().decode('utf-8')
                print(f"[SUCCESS {resp.status}] {url} with {list(header_mode.keys())[0]}: {data[:300]}")
                break
        except urllib.error.HTTPError as e:
            if e.code not in [404, 401, 403]:
                print(f"[HTTP {e.code}] {url} with {list(header_mode.keys())[0]}: {e.read().decode('utf-8', errors='ignore')[:200]}")
            elif e.code in [401, 403]:
                pass
            else:
                pass
        except Exception as e:
            pass
