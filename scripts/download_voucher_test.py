import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

EMAIL = "milagrosjanetamis@gmail.com"
PASSWORD = "986398Mi$"
API_KEY = "sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma"
BASE_URL = "https://api.shalom-api-peru.com"

headers = {
    "X-API-Key": API_KEY,
    "X-Shalom-Email": EMAIL,
    "X-Shalom-Password": PASSWORD,
    "Content-Type": "application/json"
}

def download_voucher():
    url = f"{BASE_URL}/v1/orders/92644276/voucher"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=ctx) as r:
        pdf_bytes = r.read()
        with open("voucher_test_92644276.pdf", "wb") as f:
            f.write(pdf_bytes)
        print(f"Downloaded voucher PDF: {len(pdf_bytes)} bytes saved to voucher_test_92644276.pdf")

if __name__ == '__main__':
    download_voucher()
