import re

with open("voucher_test_92644276.pdf", "rb") as f:
    data = f.read()

# Extract readable strings
strings = re.findall(rb'[A-Za-z0-9\s,.:/\-()]{4,}', data)
for s in strings[:40]:
    try:
        decoded = s.decode('utf-8').strip()
        if len(decoded) > 3:
            print(decoded)
    except:
        pass
