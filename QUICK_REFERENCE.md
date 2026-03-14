# 🎯 Quick Reference: What Changed

## Files to Replace (3 files):

### 1. backend/config.py
**Lines 40-50 changed:**
```python
# OLD (OpenRouter):
OPENROUTER_KEYS: list[str] = []
_keys_env = os.getenv("OPENROUTER_KEYS", "")
if _keys_env:
    OPENROUTER_KEYS = [k.strip() for k in _keys_env.split(",") if k.strip()]
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "mistralai/mistral-7b-instruct:free")

# NEW (NVIDIA):
NVIDIA_API_KEYS: list[str] = []
_keys_env = os.getenv("NVIDIA_API_KEYS", "")
if _keys_env:
    NVIDIA_API_KEYS = [k.strip() for k in _keys_env.split(",") if k.strip()]
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")
```

---

### 2. backend/services/nvidia_service.py
**NEW FILE** - Copy from package

---

### 3. backend/routers/ai.py
**Line 6 changed:**
```python
# OLD:
from backend.services.openrouter_service import (

# NEW:
from backend.services.nvidia_service import (
```

**Line 97 changed:**
```python
# OLD:
from backend.services.openrouter_service import analyze_ats

# NEW:
from backend.services.nvidia_service import analyze_ats
```

---

## Environment Variables (Render):

### ❌ DELETE:
- `OPENROUTER_KEYS`
- `OPENROUTER_MODEL`

### ✅ ADD:
- `NVIDIA_API_KEYS` = `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`
- `NVIDIA_MODEL` = `meta/llama-3.3-70b-instruct`

---

## That's it! 🎉

Just 3 files changed, 2 environment variables updated.
