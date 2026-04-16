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
                # Potential end of string. Peek ahead to see if it's structural.
                # A structural quote is followed by , } ] or : or whitespace + one of those.
                j = i + 1
                is_structural = False
                while j < len(content):
                    next_c = content[j]
                    if next_c in ' \t\n\r':
                        j += 1
                        continue
                    if next_c in ',}]:':
                        is_structural = True
                        break
                    else:
                        break
                
                if is_structural or i == len(content) - 1:
                    in_string = False
                    repaired.append('"')
                else:
                    # Internal unescaped quote! Escape it.
                    repaired.append('\\"')
            elif char == '\\' and not escaped:
                escaped = True
                repaired.append(char)
            else:
                if char == '\n' or char == '\r':
                    repaired.append('\\n') # Escape newlines in strings
                else:
                    repaired.append(char)
                escaped = False
        else:
            if char == '"':
                # Potential start of string.
                # Check if we need a missing comma before this quote.
                # If the previous non-whitespace char was " } or ] or a digit, we need a comma.
                prev_idx = len(repaired) - 1
                while prev_idx >= 0 and (repaired[prev_idx] in ' \t\n\r' or not repaired[prev_idx].strip()):
                    prev_idx -= 1
                
                if prev_idx >= 0 and repaired[prev_idx] in '"}]0123456789':
                    repaired.append(',')
                    repaired.append(' ')
                
                in_string = True
                repaired.append('"')
            elif char == '{':
                stack.append('}')
                repaired.append(char)
            elif char == '[':
                stack.append(']')
                repaired.append(char)
            elif char == '}' or char == ']':
                # If the AI uses } instead of ], or vice versa, we try to follow the stack
                if stack:
                    expected = stack.pop()
                    repaired.append(expected)
                else:
                    # Ignore extra closers
                    pass
            elif char == ':':
                repaired.append(char)
            elif char == ',':
                # Avoid trailing commas before closing braces
                peek_idx = i + 1
                while peek_idx < len(content) and content[peek_idx] in ' \t\n\r':
                    peek_idx += 1
                if peek_idx < len(content) and content[peek_idx] in '}]':
                    # Skip this comma
                    pass
                else:
                    repaired.append(char)
            elif char.isdigit() or char == '.':
                repaired.append(char)
            elif char in ' \t\n\r':
                repaired.append(char)
        
        i += 1

    # Close everything
    if in_string:
        repaired.append('"')
    
    # NEW: Handle mid-property truncation.
    # If the last structural char was a quote " and we're inside an object, 
    # we might be waiting for a colon. Check the context.
    final_str = "".join(repaired).strip()
    
    # If it ends with a dangling key (e.g., ... { "partial_key" )
    # we need to remove that last key to make it valid JSON before closing braces
    if final_str.endswith('"') or final_str.endswith('",'):
        # Primitive check: if no colon exists since the last { or ,
        last_brace = max(final_str.rfind('{'), final_str.rfind(','))
        last_colon = final_str.rfind(':')
        if last_brace > last_colon:
            # We have a key without a value. Prune it.
            final_str = final_str[:last_brace+1].strip()
            if final_str.endswith(','):
                final_str = final_str[:-1].strip()

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
            return json.loads(repaired)
            
    except Exception as e:
        # Be noisy about the failure and show the content for debugging
        logger.warning(f"[JSON Repair] Failed to parse/repair. Error: {e}")
        # Only log a slice to keep logs manageable but useful
        logger.warning(f"[JSON Repair] Snippet of failed content: {content[:1000]}")
        return {}
