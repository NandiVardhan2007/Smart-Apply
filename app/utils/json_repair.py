import re
import json
import logging

logger = logging.getLogger(__name__)

def repair_json(content: str) -> str:
    """Robust heuristic to close unclosed JSON structures and handle minor malformations."""
    if not content:
        return "{}"

    # First attempt to clean out markdown blocks
    content = content.strip()
    if content.startswith("```"):
        if "```json" in content:
            content = content.split("```json", 1)[1].split("```", 1)[0].strip()
        else:
            content = content.split("```", 1)[1].split("```", 1)[0].strip()

    # 0. Find the first '{'
    start_idx = content.find('{')
    if start_idx == -1:
        return "{}"
    
    # Check if there is anything after the last } and remove it
    end_idx = content.rfind('}')
    if end_idx != -1 and end_idx > start_idx:
        # If we have a relatively balanced object, we take it.
        # Otherwise we assume it's truncated and take everything from {
        if content[start_idx:end_idx+1].count('{') == content[start_idx:end_idx+1].count('}'):
             content = content[start_idx:end_idx+1]
        else:
             content = content[start_idx:]
    else:
        content = content[start_idx:]

    # 1. Handle unescaped newlines in strings
    def fix_newlines(match):
        return match.group(0).replace('\n', '\\n').replace('\r', '\\r')
    
    content = re.sub(r'":\s*"([^"]*)"', fix_newlines, content)

    # 2. Fix unescaped quotes inside strings (CRITICAL for llama results)
    # This tries to escape quotes that are not followed by , : } or ]
    # Or preceded by { , or :
    def fix_internal_quotes(match):
        text = match.group(1)
        # Escape quotes that are not structural
        # This is a bit risky but often necessary
        fixed = text.replace('"', '\\"')
        return f'": "{fixed}"'
    
    # We only apply this to values known to be strings in our schema
    # like summary, name, findings, icon, title, reason, suggestion
    target_keys = ["summary", "name", "icon", "title", "grade", "reason", "suggestion", "finding"]
    for key in target_keys:
        # Match complete values
        content = re.sub(rf'"{key}"\s*:\s*"(.+?)"(?=\s*[,}}])', fix_internal_quotes, content, flags=re.DOTALL)
        # Handle cases where it's truncated or doesn't have a trailing comma yet
        content = re.sub(rf'"{key}"\s*:\s*"([^"]+)"\s*$', fix_internal_quotes, content, flags=re.DOTALL)

    # 3. Fix missing commas between elements (heuristic)
    content = re.sub(r'\}\s*\{', '}, {', content)
    content = re.sub(r'\]\s*\[', '], [', content)
    content = re.sub(r'\"\s*\"', '", "', content)
    content = re.sub(r'\"\s*\{', '", {', content)
    content = re.sub(r'\}\s*\"', '}, "', content)

    # 4. Remove trailing unclosed key or partial property
    content = re.sub(r',?\s*\"[^\"]*\"\s*:\s*$', '', content)
    content = re.sub(r',\s*$', '', content)

    # 5. Close open quotes if odd number
    if content.count('"') % 2 != 0:
        content += '"'

    # 6. Stack-based closer for brackets and braces
    stack = []
    in_string = False
    escaped = False

    for char in content:
        if char == '"' and not escaped:
            in_string = not in_string
        elif not in_string:
            if char == '{':
                stack.append('}')
            elif char == '[':
                stack.append(']')
            elif char == '}' or char == ']':
                if stack and stack[-1] == char:
                    stack.pop()

        if char == '\\' and not escaped:
            escaped = True
        else:
            escaped = False

    for closer in reversed(stack):
        content += closer

    return content

def robust_json_loads(content: str) -> dict:
    """Attempts to load JSON, repairing it if necessary."""
    if not content:
        return {}
        
    try:
        # First attempt: Clean up markdown blocks if present
        cleaned = content.strip()
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()
            
        return json.loads(cleaned)
    except Exception:
        try:
            # Second attempt: Repair the string
            repaired = repair_json(content)
            return json.loads(repaired)
        except Exception as e:
            # Be noisy about the failure and show the content for debugging
            # We use warning so it's visible in most logs
            logger.warning(f"[JSON Repair] Failed to parse/repair. Error: {e}")
            # Only log a slice to keep logs manageable but useful
            logger.warning(f"[JSON Repair] Snippet of failed content: {content[:1000]}")
            return {}
