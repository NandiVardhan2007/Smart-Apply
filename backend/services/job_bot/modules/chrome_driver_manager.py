'''
chrome_driver_manager.py — Smart ChromeDriver Auto-Manager for SmartApply

Logic:
  1. Detect the installed Chrome version on this machine.
  2. Check if we already have a matching ChromeDriver cached locally.
  3. If not, download it from:
       https://storage.googleapis.com/chrome-for-testing-public/{version}/win64/chromedriver-win64.zip
  4. Extract the zip and cache the driver in:
       <project_root>/chromedriver_cache/{version}/chromedriver.exe
  5. Return the path to the correct chromedriver.exe for Selenium.

Supports: Windows (win64), macOS (mac-x64 / mac-arm64), Linux (linux64)
'''

import os
import sys
import zipfile
import platform
import subprocess
import urllib.request
from pathlib import Path

# ── Where we store downloaded ChromeDrivers ──────────────────────────────────
# Goes into the project root (two levels above this file: modules/ → job_bot/ → services/ → backend/ → project root)
_THIS_FILE   = Path(__file__).resolve()
_PROJECT_ROOT = _THIS_FILE.parents[4]          # adjust if folder depth changes
CACHE_DIR     = _PROJECT_ROOT / "chromedriver_cache"


# ── Platform → Chrome-for-Testing platform string ────────────────────────────
def _get_cft_platform() -> str:
    system = platform.system()
    machine = platform.machine().lower()

    if system == "Windows":
        return "win64"
    elif system == "Darwin":
        # Apple Silicon vs Intel
        return "mac-arm64" if ("arm" in machine or "aarch" in machine) else "mac-x64"
    else:
        return "linux64"


# ── Detect installed Chrome version ──────────────────────────────────────────
def get_chrome_version() -> str | None:
    """Return the full Chrome version string, e.g. '145.0.7632.160', or None."""
    system = platform.system()

    try:
        if system == "Windows":
            # Registry is the most reliable source on Windows
            import winreg
            for key_path in [
                r"SOFTWARE\Google\Chrome\BLBeacon",
                r"SOFTWARE\Wow6432Node\Google\Chrome\BLBeacon",
            ]:
                try:
                    key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key_path)
                    version, _ = winreg.QueryValueEx(key, "version")
                    winreg.CloseKey(key)
                    return version.strip()
                except FileNotFoundError:
                    continue

            # Fallback: ask PowerShell
            result = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "(Get-Item 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe').VersionInfo.FileVersion"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()

        elif system == "Darwin":
            for app in [
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "/Applications/Chromium.app/Contents/MacOS/Chromium",
            ]:
                if Path(app).exists():
                    result = subprocess.run([app, "--version"], capture_output=True, text=True, timeout=10)
                    if result.returncode == 0:
                        # "Google Chrome 145.0.7632.160"
                        parts = result.stdout.strip().split()
                        return parts[-1]

        else:
            # Linux
            for cmd in ["google-chrome", "google-chrome-stable", "chromium-browser", "chromium"]:
                try:
                    result = subprocess.run([cmd, "--version"], capture_output=True, text=True, timeout=10)
                    if result.returncode == 0:
                        parts = result.stdout.strip().split()
                        return parts[-1]
                except FileNotFoundError:
                    continue

    except Exception as e:
        print(f"[ChromeManager] Warning: could not detect Chrome version — {e}")

    return None


# ── Build Chrome-for-Testing download URL ────────────────────────────────────
def _build_download_url(version: str, cft_platform: str) -> str:
    return (
        f"https://storage.googleapis.com/chrome-for-testing-public"
        f"/{version}/{cft_platform}/chromedriver-{cft_platform}.zip"
    )


# ── Try to find the nearest available version from CFT JSON endpoint ─────────
def _find_nearest_cft_version(major: str) -> str | None:
    """
    Query the Chrome-for-Testing known-good-versions API to find a version
    whose major matches the installed Chrome major.  Returns the best match
    or None if the API is unreachable.
    """
    api_url = "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json"
    try:
        with urllib.request.urlopen(api_url, timeout=15) as resp:
            import json
            data = json.loads(resp.read())

        candidates = [
            v["version"]
            for v in data.get("versions", [])
            if v["version"].split(".")[0] == major
            and any(
                d.get("platform") == _get_cft_platform()
                for d in v.get("downloads", {}).get("chromedriver", [])
            )
        ]
        # Return the last (highest) matching version
        return candidates[-1] if candidates else None

    except Exception as e:
        print(f"[ChromeManager] Warning: CFT API lookup failed — {e}")
        return None


# ── Download + extract ChromeDriver ──────────────────────────────────────────
def _download_chromedriver(version: str, cft_platform: str, dest_dir: Path) -> Path:
    """Download chromedriver zip and extract; return path to chromedriver(.exe)."""
    url  = _build_download_url(version, cft_platform)
    zip_path = dest_dir / "chromedriver.zip"

    print(f"[ChromeManager] Downloading ChromeDriver {version} from:")
    print(f"[ChromeManager]   {url}")

    os.makedirs(dest_dir, exist_ok=True)

    try:
        urllib.request.urlretrieve(url, zip_path)
    except Exception as e:
        raise RuntimeError(
            f"Failed to download ChromeDriver {version}.\n"
            f"URL tried: {url}\n"
            f"Error: {e}\n\n"
            "Possible fixes:\n"
            "  • Check your internet connection.\n"
            "  • This Chrome version may not have a matching ChromeDriver yet.\n"
            "    Try downgrading Chrome or waiting for a new ChromeDriver release."
        )

    print(f"[ChromeManager] Extracting to {dest_dir} ...")
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(dest_dir)
    zip_path.unlink()   # clean up zip

    # Find the extracted chromedriver binary
    exe_name = "chromedriver.exe" if platform.system() == "Windows" else "chromedriver"

    # CFT zips contain a sub-folder like "chromedriver-win64/chromedriver.exe"
    for candidate in dest_dir.rglob(exe_name):
        # Make it executable on Unix
        if platform.system() != "Windows":
            candidate.chmod(0o755)
        print(f"[ChromeManager] ChromeDriver ready at: {candidate}")
        return candidate

    raise RuntimeError(f"Could not find '{exe_name}' inside the downloaded zip.")


# ── Public API ────────────────────────────────────────────────────────────────
def get_chromedriver_path() -> str:
    """
    Main entry point.

    Returns the absolute path to a chromedriver binary that matches the
    currently installed Chrome.  Downloads it automatically if needed.
    """
    cft_platform = _get_cft_platform()
    chrome_version = get_chrome_version()

    if not chrome_version:
        raise RuntimeError(
            "Could not detect your installed Chrome version.\n"
            "Make sure Google Chrome is installed and try again."
        )

    print(f"[ChromeManager] Detected Chrome version: {chrome_version}")
    major = chrome_version.split(".")[0]

    # ── Check cache first ─────────────────────────────────────────────────────
    cache_version_dir = CACHE_DIR / chrome_version
    exe_name = "chromedriver.exe" if platform.system() == "Windows" else "chromedriver"

    cached = list(cache_version_dir.rglob(exe_name)) if cache_version_dir.exists() else []
    if cached:
        print(f"[ChromeManager] Using cached ChromeDriver: {cached[0]}")
        return str(cached[0])

    # ── Need to download ──────────────────────────────────────────────────────
    # First try the exact version; if that 404s, query the CFT API for the
    # nearest available build with the same major version number.
    version_to_download = chrome_version

    test_url = _build_download_url(chrome_version, cft_platform)
    try:
        urllib.request.urlopen(test_url, timeout=8)          # HEAD-like check
    except Exception:
        print(f"[ChromeManager] Exact version {chrome_version} not on CFT — querying API for nearest build...")
        nearest = _find_nearest_cft_version(major)
        if nearest:
            print(f"[ChromeManager] Using nearest available version: {nearest}")
            version_to_download = nearest
            cache_version_dir   = CACHE_DIR / nearest
        else:
            print(f"[ChromeManager] API lookup failed — will attempt exact version anyway.")

    driver_path = _download_chromedriver(version_to_download, cft_platform, cache_version_dir)
    return str(driver_path)
