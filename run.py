#!/usr/bin/env python3
import sys, argparse, subprocess
from pathlib import Path
BASE = Path(__file__).parent

def check_deps():
    try:
        import fastapi, motor, pydantic, jwt, bcrypt
        print("✅ Core dependencies OK")
    except ImportError as e:
        print(f"❌ Missing dependency: {e}\n   Run: pip install -r requirements.txt")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prod", action="store_true")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", default=8000, type=int)
    parser.add_argument("--workers", default=1, type=int)
    args = parser.parse_args()
    print("\n" + "═"*50)
    print("  SmartApply  🤖  Job Application Automation")
    print("═"*50)
    check_deps()
    env_path = BASE / ".env"
    if not env_path.exists():
        print("⚠️  .env file not found — copy .env.example to .env and fill in values")
        sys.exit(1)
    print(f"\n🚀 Starting at http://{args.host}:{args.port}")
    print(f"   Docs: http://localhost:{args.port}/api/docs\n")
    cmd = [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", args.host, "--port", str(args.port)]
    if args.prod: cmd += ["--workers", str(args.workers)]
    else: cmd += ["--reload"]
    subprocess.run(cmd)

if __name__ == "__main__":
    main()
