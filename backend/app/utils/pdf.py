"""PDF helpers.

PyMuPDF (``fitz``) is a synchronous C-extension: parsing a multi-page PDF on
the event loop stalls every other request on the same worker — which on the
free tier is the *only* worker. Callers must run these off the loop with
``starlette.concurrency.run_in_threadpool``.
"""

import fitz  # PyMuPDF


def extract_pdf_text(content: bytes) -> str:
    """Return the concatenated text of every page in a PDF byte stream.

    Raises the underlying ``fitz`` error if the bytes aren't a valid PDF; the
    caller is expected to translate that into a 400.
    """
    doc = fitz.open(stream=content, filetype="pdf")
    try:
        return "\n".join(page.get_text() for page in doc) + "\n"
    finally:
        doc.close()
