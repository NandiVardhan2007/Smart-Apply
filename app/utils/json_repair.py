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
    if "```json" in content:
        content = content.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in content:
        content = content.split("```", 1)[1].split("```", 1)[0].strip()

    # Find the first '{'
    start_idx = content.find('{')
    if start_idx == -1:
        return "{}"
    content = content[start_idx:]

    # State machine to repair JSON
    repaired = []
    stack = []
    in_string = False
    escaped = False
    
    i = 0
    while i < len(content):
        char = content[i]
        
        if in_string:
            if char == '"' and not escaped:
                # Actual end of string
                in_string = False
                repaired.append('"')
            elif char == '\\' and not escaped:
                escaped = True
                repaired.append(char)
            else:
                if char == '\n' or char == '\r':
                    repaired.append('\\n') 
                else:
                    repaired.append(char)
                escaped = False
        else:
            if char == '"':
                # Check for missing comma before starting a new string (potential key)
                if repaired:
                    prev_non_white = ""
                    for j in range(len(repaired)-1, -1, -1):
                        if repaired[j] not in ' \t\n\r':
                            prev_non_white = repaired[j]
                            break
                    if prev_non_white in '"}]':
                        repaired.append(',')
                
                in_string = True
                repaired.append('"')
            elif char == '{':
                # Check for missing comma between objects in an array
                if repaired:
                    prev_non_white = ""
                    for j in range(len(repaired)-1, -1, -1):
                        if repaired[j] not in ' \t\n\r':
                            prev_non_white = repaired[j]
                            break
                    if prev_non_white in '"}]':
                        repaired.append(',')
                
                stack.append('}')
                repaired.append(char)
            elif char == '[':
                stack.append(']')
                repaired.append(char)
            elif char == '}' or char == ']':
                if stack:
                    # AI might close with wrong bracket, we force the right one
                    expected = stack.pop()
                    repaired.append(expected)
                # If stack is empty, it's an extra bracket - skip it
            elif char == ':':
                repaired.append(char)
            elif char == ',':
                # Avoid trailing commas
                peek_idx = i + 1
                while peek_idx < len(content) and content[peek_idx] in ' \t\n\r':
                    peek_idx += 1
                if peek_idx < len(content) and content[peek_idx] in '}]':
                    pass
                else:
                    repaired.append(char)
            elif char.isalnum() or char in '.-+':
                # Allow letters for true/false/null and numbers (including scientific notation)
                repaired.append(char)
            elif char in ' \t\n\r':
                repaired.append(char)
        
        i += 1

    # CLEANUP PHASE: The content was truncated.
    # 1. Close open string
    if in_string:
        repaired.append('"')
    
    # 2. Convert list to string for final pruning
    final_str = "".join(repaired).strip()
    
    # 3. Prune dangling structural elements (like a key with no value, or a comma at the end)
    while True:
        changed = False
        final_str = final_str.strip()
        
        # Remove trailing comma
        if final_str.endswith(','):
            final_str = final_str[:-1].strip()
            changed = True
            
        # Remove a key that has no value (e.g., ... "summary": )
        if final_str.endswith(':'):
            # Find the start of the key
            last_quote = final_str.rfind('"', 0, -1)
            if last_quote != -1:
                # Find the quote before that
                prev_quote = final_str.rfind('"', 0, last_quote)
                if prev_quote != -1:
                    # Prune everything after the comma or brace before this key
                    last_sep = -1
                    for sep in [',', '{', '[']:
                        idx = final_str.rfind(sep, 0, prev_quote)
                        if idx > last_sep: last_sep = idx
                    
                    if last_sep != -1:
                        final_str = final_str[:last_sep+1].strip()
                        changed = True
                    else:
                        # It was the only key in the root object
                        final_str = "{"
                        changed = True

        if not changed:
            break

    # 4. Close all open braces/brackets
    while stack:
        final_str += stack.pop()
    
    return final_str

def robust_json_loads(content: str) -> dict:
    """Attempts to load JSON, repairing it if necessary."""
    if not content:
        return {}
        
    try:
        # Step 1: Aggressive Extraction
        # Find the first '{' and last '}'
        start_idx = content.find('{')
        end_idx = content.rfind('}')
        
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            cleaned = content[start_idx:end_idx + 1].strip()
        else:
            cleaned = content.strip()

        # Step 2: Markdown block cleaning (just in case)
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()
            
        try:
            return json.loads(cleaned)
        except Exception:
            # Step 3: Repair the string
            repaired = repair_json(cleaned)
            try:
                return json.loads(repaired)
            except Exception as e:
                # If it still fails, try to find the largest valid JSON block
                # This handles cases where the AI appends garbage or repeats itself
                logger.warning(f"[JSON Repair] Basic repair failed, trying block recovery. Error: {e}")
                
                # Heuristic: if we have multiple {}, try the first full one
                stack = []
                for i, c in enumerate(repaired):
                    if c == '{': stack.append(i)
                    elif c == '}':
                        if stack:
                            start = stack.pop()
                            if not stack: # Top level block
                                candidate = repaired[start:i+1]
                                try:
                                    return json.loads(candidate)
                                except: continue
                
                raise e # Re-raise if block recovery fails
            
    except Exception as e:
        # Be noisy about the failure and show the content for debugging
        logger.warning(f"[JSON Repair] CRITICAL FAILURE. Error: {e}")
        # Log a larger slice if it failed critically
        logger.warning(f"[JSON Repair] Failed content (first 2000 chars): {content[:2000]}")
        return {}
