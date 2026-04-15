import re
import json
import logging

logger = logging.getLogger(__name__)

def repair_json(content: str) -> str:
    """Robust heuristic to close unclosed JSON structures and handle minor malformations."""
    if not content:
        return "{}"

    content = content.strip()
    
    # 0. Find the first '{' and last '}'
    start_idx = content.find('{')
    if start_idx == -1:
        return "{}"
    
    # Check if there is anything after the last } and remove it
    end_idx = content.rfind('}')
    if end_idx != -1 and end_idx > start_idx:
        # If we have a complete JSON object followed by text, we might be fine,
        # but if we're truncated, we want to KEEP the truncated part to attempt repair.
        # So we only cut if the curly braces are balanced.
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

    # 2. Fix missing commas between elements (heuristic)
    content = re.sub(r'\}\s*\{', '}, {', content)
    content = re.sub(r'\]\s*\[', '], [', content)
    content = re.sub(r'\"\s*\"', '", "', content)

    # 3. Remove trailing unclosed key or partial property
    content = re.sub(r',?\s*\"[^\"]*\"\s*:\s*$', '', content)
    content = re.sub(r',\s*$', '', content)

    # 4. Close open quotes if odd number
    if content.count('"') % 2 != 0:
        content += '"'

    # 5. Stack-based closer for brackets and braces
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
            cleaned = cleaned.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```")[1].split("```")[0].strip()
            
        return json.loads(cleaned)
    except json.JSONDecodeError:
        try:
            # Second attempt: Repair the string
            repaired = repair_json(content)
            return json.loads(repaired)
        except Exception as e:
            logger.error(f"Failed to parse and repair JSON: {e}")
            logger.debug(f"Raw content was: {content[:1000]}")
            return {}
