#!/bin/bash

# ══════════════════════════════════════════════════════════════════════════════
# SmartApply - NVIDIA NIM Fix Script (Fixed Version)
# ══════════════════════════════════════════════════════════════════════════════
# Run from your SmartApply project ROOT directory:
#   bash migrate_fixed.sh
# ══════════════════════════════════════════════════════════════════════════════

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  SmartApply - NVIDIA NIM Fix (Corrected Version)                  ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# ── Verify we're in the right directory ───────────────────────────────────────
if [ ! -d "backend" ]; then
    echo "❌ Error: backend/ directory not found."
    echo "   Run this script from your SmartApply project ROOT directory."
    exit 1
fi

echo "📍 Project root: $(pwd)"

# ── Backup existing files ──────────────────────────────────────────────────────
BACKUP="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP"
echo ""
echo "📦 Backing up existing files → $BACKUP/"
[ -f "backend/config.py" ]                          && cp backend/config.py "$BACKUP/" && echo "   ✓ config.py"
[ -f "backend/routers/ai.py" ]                      && cp backend/routers/ai.py "$BACKUP/" && echo "   ✓ routers/ai.py"
[ -f "backend/services/openrouter_service.py" ]     && cp backend/services/openrouter_service.py "$BACKUP/" && echo "   ✓ openrouter_service.py (old)"
[ -f "backend/services/nvidia_service.py" ]         && cp backend/services/nvidia_service.py "$BACKUP/" && echo "   ✓ nvidia_service.py (previous)"
[ -f ".env" ]                                       && cp .env "$BACKUP/.env.bak" && echo "   ✓ .env"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo ""
echo "📝 Applying fixed files..."

# ── 1. config.py ──────────────────────────────────────────────────────────────
cp "$SCRIPT_DIR/backend/config.py" backend/config.py
echo "   ✓ backend/config.py"

# ── 2. nvidia_service.py ──────────────────────────────────────────────────────
cp "$SCRIPT_DIR/backend/services/nvidia_service.py" backend/services/nvidia_service.py
echo "   ✓ backend/services/nvidia_service.py"

# ── 3. routers/ai.py ──────────────────────────────────────────────────────────
cp "$SCRIPT_DIR/backend/routers/ai.py" backend/routers/ai.py
echo "   ✓ backend/routers/ai.py"

# ── 4. .env (only if not already customised) ──────────────────────────────────
if [ -f ".env" ] && grep -q "NVIDIA_API_KEYS" .env; then
    echo "   ℹ️  .env already has NVIDIA_API_KEYS — skipping to preserve your key"
else
    cp "$SCRIPT_DIR/.env" .env
    echo "   ✓ .env (updated)"
fi

# ── 5. Remove old openrouter_service.py if still present ─────────────────────
if [ -f "backend/services/openrouter_service.py" ]; then
    mv backend/services/openrouter_service.py "$BACKUP/openrouter_service.py"
    echo "   ✓ Moved openrouter_service.py → $BACKUP/ (no longer needed)"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  ✅ Fix applied successfully!                                      ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
echo "── Local dev ────────────────────────────────────────────────────────"
echo "  python run.py"
echo "  # or"
echo "  uvicorn backend.main:app --reload"
echo ""
echo "── Render deployment ────────────────────────────────────────────────"
echo "  git add backend/ .env"
echo "  git commit -m 'fix: switch to NVIDIA NIM, correct model IDs'"
echo "  git push"
echo ""
echo "  Then in Render dashboard → Environment:"
echo "    DELETE:  OPENROUTER_KEYS, OPENROUTER_MODEL"
echo "    ADD:     NVIDIA_API_KEYS = nvapi-xxxxxxxxxxxx"
echo "    ADD:     NVIDIA_MODEL    = meta/llama-3.3-70b-instruct"
echo ""
echo "  Backup saved in: $BACKUP/"
echo ""
