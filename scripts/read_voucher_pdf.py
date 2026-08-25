try:
    import pypdf
    reader = pypdf.PdfReader("test_ep_voucher.pdf")
    print("Total pages:", len(reader.pages))
    for i, page in enumerate(reader.pages):
        print(f"--- PAGE {i+1} ---")
        print(page.extract_text())
except Exception as e:
    print("Error:", e)
