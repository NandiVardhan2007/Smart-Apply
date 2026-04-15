import io
from pdfminer.high_level import extract_text

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts raw text from a PDF file provided as bytes."""
    try:
        # pdfminer.six's extract_text can take a file-like object
        fp = io.BytesIO(file_bytes)
        text = extract_text(fp)
        return text.strip()
    except Exception as e:
        print(f"Error extracting PDF: {e}")
        return ""
