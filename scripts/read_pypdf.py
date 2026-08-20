from pypdf import PdfReader

reader = PdfReader("voucher_test_92644276.pdf")
print("Number of pages:", len(reader.pages))
for idx, page in enumerate(reader.pages):
    print(f"=== PAGE {idx+1} ===")
    print(page.extract_text())
