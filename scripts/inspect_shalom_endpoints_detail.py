import urllib.request
import json

SHALOM_URL = "https://api-pro.shalom.pe"
# Let's read the Shalom token from shalom.service.ts or shalom.controller.ts

# We can query through our backend on localhost / VPS or directly with Shalom Pro credentials
# Let's check backend shalom credentials
with open("backend/src/services/shalom.service.ts", "r", encoding="utf-8") as f:
    code = f.read()
    print("Shalom service excerpt:")
    print(code[:500])
