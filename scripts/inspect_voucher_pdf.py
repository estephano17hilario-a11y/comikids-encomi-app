try:
    import fitz # PyMuPDF
    doc = fitz.open("voucher_test_92644276.pdf")
    print(f"Pages: {len(doc)}")
    for i, page in enumerate(doc):
        text = page.get_text()
        print(f"--- Page {i+1} ---")
        print(text)
        pix = page.get_pixmap(dpi=150)
        pix.save("voucher_preview_page.png")
        print("[*] Saved preview to voucher_preview_page.png")
except Exception as e:
    print(f"Error: {e}")
    # fallback to binary search of text
    with open("voucher_test_92644276.pdf", "rb") as f:
        content = f.read()
        print(f"PDF size: {len(content)} bytes")
