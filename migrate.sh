#!/bin/bash

# ══════════════════════════════════════════════════════════════════════════════
# SmartApply - NVIDIA NIM Migration Script
# ══════════════════════════════════════════════════════════════════════════════
# This script automatically updates your SmartApply project to use NVIDIA NIM API
# ══════════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  SmartApply - NVIDIA NIM Migration                                 ║"
echo "║  Switching from OpenRouter to NVIDIA's Free AI API                 ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    echo "❌ Error: backend/ directory not found"
    echo "   Please run this script from your SmartApply project root directory"
    exit 1
fi

echo "📍 Current directory: $(pwd)"
echo ""

# Create backup
echo "📦 Creating backup..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp backend/config.py "$BACKUP_DIR/" 2>/dev/null || echo "   ⚠️  config.py not found (will create new)"
cp backend/routers/ai.py "$BACKUP_DIR/" 2>/dev/null || echo "   ⚠️  ai.py not found"
cp backend/services/openrouter_service.py "$BACKUP_DIR/" 2>/dev/null || echo "   ⚠️  openrouter_service.py not found"
echo "   ✓ Backup created in: $BACKUP_DIR/"
echo ""

# Get the script directory (where the updated files are)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Copy updated files
echo "📝 Updating files..."

# 1. Update config.py
if [ -f "$SCRIPT_DIR/backend/config.py" ]; then
    cp "$SCRIPT_DIR/backend/config.py" backend/
    echo "   ✓ Updated backend/config.py"
else
    echo "   ❌ Missing: backend/config.py in update package"
    exit 1
fi

# 2. Create nvidia_service.py
if [ -f "$SCRIPT_DIR/backend/services/nvidia_service.py" ]; then
    cp "$SCRIPT_DIR/backend/services/nvidia_service.py" backend/services/
    echo "   ✓ Created backend/services/nvidia_service.py"
else
    echo "   ❌ Missing: backend/services/nvidia_service.py in update package"
    exit 1
fi

# 2b. Update bot_service.py
if [ -f "$SCRIPT_DIR/backend/services/bot_service.py" ]; then
    cp "$SCRIPT_DIR/backend/services/bot_service.py" backend/services/
    echo "   ✓ Updated backend/services/bot_service.py"
else
    echo "   ❌ Missing: backend/services/bot_service.py in update package"
    exit 1
fi

# 3. Update ai.py
if [ -f "$SCRIPT_DIR/backend/routers/ai.py" ]; then
    cp "$SCRIPT_DIR/backend/routers/ai.py" backend/routers/
    echo "   ✓ Updated backend/routers/ai.py"
else
    echo "   ❌ Missing: backend/routers/ai.py in update package"
    exit 1
fi

# 4. Update .env if provided
if [ -f "$SCRIPT_DIR/.env" ]; then
    if [ -f ".env" ]; then
        cp .env "$BACKUP_DIR/.env.backup"
        echo "   ✓ Backed up existing .env"
    fi
    cp "$SCRIPT_DIR/.env" .env
    echo "   ✓ Updated .env with NVIDIA API key"
fi

echo ""
echo "✅ Migration completed successfully!"
echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  Next Steps:                                                       ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
echo "For LOCAL development:"
echo "  1. Restart your server: python run.py"
echo "  2. Test: curl http://localhost:8000/health"
echo ""
echo "For RENDER deployment:"
echo "  1. git add backend/"
echo "  2. git commit -m 'Switch to NVIDIA NIM API'"
echo "  3. git push"
echo "  4. Update environment variables in Render dashboard:"
echo "     - Delete: OPENROUTER_KEYS, OPENROUTER_MODEL"
echo "     - Add: NVIDIA_API_KEYS, NVIDIA_MODEL"
echo "     See DEPLOYMENT_GUIDE.md for detailed instructions"
echo ""
echo "📚 Read DEPLOYMENT_GUIDE.md for complete instructions"
echo "🔒 Your backup is in: $BACKUP_DIR/"
echo ""
echo "🎉 You're now using NVIDIA's free AI models!"
echo ""
