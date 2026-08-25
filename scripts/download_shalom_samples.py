import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

API_KEY = "sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma"
BASE_URL = "https://api.shalom-api-peru.com"
ORDER_ID = "96696148"  # Marinela del Carmen Tafur (Guía V204-93223686)

# 1. Descargar /label
req_label = urllib.request.Request(f"{BASE_URL}/v1/orders/{ORDER_ID}/label", headers={
    "X-API-Key": API_KEY,
    "X-Shalom-Email": "milagrosjanetamis@gmail.com",
    "X-Shalom-Password": "986398Mi$",
    "User-Agent": "Mozilla/5.0"
})
with urllib.request.urlopen(req_label, context=ctx, timeout=15) as resp:
    label_bytes = resp.read()
    with open("sample_label.pdf", "wb") as f:
        f.write(label_bytes)
    print(f"[+] /label guardado: {len(label_bytes)} bytes")

# 2. Descargar /voucher
req_voucher = urllib.request.Request(f"{BASE_URL}/v1/orders/{ORDER_ID}/voucher", headers={
    "X-API-Key": API_KEY,
    "X-Shalom-Email": "milagrosjanetamis@gmail.com",
    "X-Shalom-Password": "986398Mi$",
    "User-Agent": "Mozilla/5.0"
})
with urllib.request.urlopen(req_voucher, context=ctx, timeout=15) as resp:
    voucher_bytes = resp.read()
    with open("sample_voucher.pdf", "wb") as f:
        f.write(voucher_bytes)
    print(f"[+] /voucher guardado: {len(voucher_bytes)} bytes")
