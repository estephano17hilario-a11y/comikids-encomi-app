import zlib
import re

with open("voucher_test_92644276.pdf", "rb") as f:
    content = f.read()

streams = re.findall(rb'stream[\r\n]+(.*?)[\r\n]+endstream', content, re.DOTALL)
print(f"Found {len(streams)} streams")
for i, s in enumerate(streams):
    try:
        decompressed = zlib.decompress(s)
        print(f"--- Stream {i+1} ---")
        # Find printable characters
        readable = re.findall(r'\((.*?)\)', decompressed.decode('latin-1', errors='ignore'))
        print("Text parts:", " ".join(readable[:50]))
    except Exception as e:
        print(f"Stream {i+1} err: {e}")
