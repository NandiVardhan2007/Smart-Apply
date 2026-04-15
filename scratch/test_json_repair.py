import json
import re

def _is_likely_truncated(content: str) -> bool:
    """Heuristic to check if JSON content ended abruptly."""
    content = content.strip()
    return not (content.endswith('}') or content.endswith(']'))

def _repair_json(content: str) -> str:
    """Robust heuristic to close unclosed JSON structures and handle minor malformations."""
    content = content.strip()
    if not content.startswith('{'): return "{}"
    
    # 1. Remove trailing garbage
    content = re.sub(r',?\s*\"[^\"]*\"\s*:\s*$', '', content)
    content = re.sub(r',\s*$', '', content)

    # 2. Close open quotes if odd number
    if content.count('"') % 2 != 0:
        content += '"'
        
    # 3. Stack-based closer
    stack = []
    in_string = False
    escaped = False
    
    for i, char in enumerate(content):
        if char == '"' and not escaped:
            in_string = not in_string
        elif not in_string:
            if char == '{': stack.append('}')
            elif char == '[': stack.append(']')
            elif char == '}' or char == ']':
                if stack and stack[-1] == char:
                    stack.pop()
        
        if char == '\\' and not escaped:
            escaped = True
        else:
            escaped = False
    
    # Add missing closers in reverse order
    for closer in reversed(stack):
        content += closer
        
    return content

# Test with the truncated sample from the logs
truncated_sample = """{
  "overall_score": 82,
  "overall_grade": "B+",
  "summary": "This resume is well-structured and effectively showcases the candidate's technical skills and experience in Flutter, AWS, and cloud computing. However, there are some minor formatting issues and a lack of quantifiable achievements in the Professional Summary.",
  "categories": [
    {
      "name": "Keyword Relevance",
      "score": 85,
      "grade": "A-",
      "icon": "search",
      "findings": [
        "The resume effectively..."""

print("--- ORIGNAL ---")
print(truncated_sample)
print("\n--- REPAIRED ---")
repaired = _repair_json(truncated_sample)
print(repaired)

try:
    parsed = json.loads(repaired)
    print("\n[OK] Successfully parsed repaired JSON!")
    print(f"Overall Score: {parsed['overall_score']}")
    print(f"Findings length: {len(parsed['categories'][0]['findings'])}")
    print(f"Last finding: {parsed['categories'][0]['findings'][0]}")
except Exception as e:
    print(f"\n[ERROR] Failed to parse repaired JSON: {e}")

# Test case 2: Truncated mid-key
truncated_sample_2 = '{"score": 90, "summary": "Good", "categories": [{"name": "Formatting"'
print("\n--- TEST CASE 2 (Truncated mid-key) ---")
repaired_2 = _repair_json(truncated_sample_2)
print(repaired_2)
try:
    json.loads(repaired_2)
    print("[OK] Successfully parsed test case 2!")
except Exception as e:
    print(f"[ERROR] Failed test case 2: {e}")

# Test case 3: Trailing comma
truncated_sample_3 = '{"a": 1, "b": 2,'
print("\n--- TEST CASE 3 (Trailing comma) ---")
repaired_3 = _repair_json(truncated_sample_3)
print(repaired_3)
try:
    json.loads(repaired_3)
    print("[OK] Successfully parsed test case 3!")
except Exception as e:
    print(f"[ERROR] Failed test case 3: {e}")
