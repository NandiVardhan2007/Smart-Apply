import os
from docx import Document

base_dir = r"D:\SMARTAPPLY\43_resume_templates"
files = [f for f in os.listdir(base_dir) if f.endswith('.docx')]
files.sort()

def audit_template(filename):
    path = os.path.join(base_dir, filename)
    try:
        doc = Document(path)
        text = "\n".join([p.text for p in doc.paragraphs])
        has_tags = "{{" in text
        print(f"File: {filename}")
        print(f"  Size: {os.path.getsize(path)} bytes")
        print(f"  Has docxtpl tags ({{{{): {has_tags}")
        print(f"  Snippet: {text[:200].replace(os.linesep, ' ')}")
        print("-" * 20)
        return has_tags
    except Exception as e:
        print(f"Error reading {filename}: {e}")
        return False

# Audit a few small, medium, and large files
samples = [files[0], files[10], files[20], files[30], files[40]]
for s in samples:
    audit_template(s)

# Count how many have tags overall
with_tags = 0
for f in files:
    if audit_template(f):
        with_tags += 1

print(f"\nTotal templates: {len(files)}")
print(f"Templates with tags: {with_tags}")
