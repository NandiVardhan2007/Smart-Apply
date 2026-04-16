import os
from docx import Document

base_dir = r"D:\SMARTAPPLY\43_resume_templates"
files = [f for f in os.listdir(base_dir) if f.endswith('.docx')]
files.sort(key=lambda x: os.path.getsize(os.path.join(base_dir, x)))

# Read the first few files to see structure
for f in files[:3]:
    print(f"--- File: {f} ---")
    doc = Document(os.path.join(base_dir, f))
    for i, para in enumerate(doc.paragraphs[:10]):
        print(f"Para {i}: {para.text}")
    print("\n")
