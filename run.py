#!/usr/bin/env python3
"""
SmartApply — Quick Start

Usage:
    python run.py              # Development mode (auto-reload)
    python run.py --prod       # Production mode
    python run.py --port 9000  # Custom port
"""

import sys
import argparse
import subprocess
from pathlib import Path

BASE = Path(__file__).parent


def check_deps():
    try:
        import fastapi, motor, pydantic, jwt, bcrypt
        print("✅ Core dependencies OK")
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("   Run: pip install -r requirements.txt")
        sys.exit(1)


def check_env():
    env_path = BASE / ".env"
    if not env_path.exists():
        print("⚠️  .env file not found — using defaults")
    else:
        print("✅ .env loaded")

    admin_path = BASE / "admin_config.json"
    if admin_path.exists():
        print("✅ admin_config.json found")


def main():
    parser = argparse.ArgumentParser(description="Run SmartApply server")
    parser.add_argument("--prod",   action="store_true", help="Production mode (no reload)")
    parser.add_argument("--host",   default="0.0.0.0",  help="Host (default: 0.0.0.0)")
    parser.add_argument("--port",   default=8000, type=int, help="Port (default: 8000)")
    parser.add_argument("--workers",default=1, type=int,    help="Worker count (prod only)")
    args = parser.parse_args()

    print("\n" + "═" * 50)
    print("  SmartApply  🤖  Job Application Automation")
    print("═" * 50)

    check_deps()
    check_env()

    print(f"\n🚀 Starting server at http://{args.host}:{args.port}")
    print(f"   Docs: http://localhost:{args.port}/api/docs\n")

    cmd = [
        sys.executable, "-m", "uvicorn",
        "backend.main:app",
        "--host", args.host,
        "--port", str(args.port),
    ]

    if args.prod:
        cmd += ["--workers", str(args.workers)]
        print("   Mode: Production")
    else:
        cmd += ["--reload"]
        print("   Mode: Development (auto-reload on)")

    subprocess.run(cmd)


if __name__ == "__main__":
    main()
