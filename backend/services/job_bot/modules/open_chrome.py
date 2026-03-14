'''
open_chrome.py — SmartApply

Supports two modes:
1. BROWSERLESS (cloud) — set BROWSERLESS_API_KEY env var
   Uses Browserless.io remote Chrome. Requires a paid plan for sessions > 60s.

2. LOCAL CHROME (self-hosted) — no BROWSERLESS_API_KEY needed
   Installs and runs Chromium directly on the Render server.
   No session timeout. Completely free. Recommended.

Set USE_LOCAL_CHROME=true in Render env vars to force local mode even if
BROWSERLESS_API_KEY is set.
'''

import os
import subprocess
import sys
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait

try:
    from modules.helpers import (
        get_default_temp_profile, make_directories, critical_error_log,
        print_lg, find_default_profile_directory,
    )
    from config.settings import (
        run_in_background, disable_extensions, safe_mode,
        file_name, failed_file_name, logs_folder_path, generated_resume_path,
    )
    from config.questions import default_resume_path
except ImportError:
    def print_lg(msg): print(msg)
    def critical_error_log(msg, e): print(f"CRITICAL: {msg} — {e}")
    def make_directories(dirs): pass
    file_name = "all_excels/applied_jobs.csv"
    failed_file_name = "all_excels/failed_jobs.csv"
    logs_folder_path = "logs/"
    generated_resume_path = "all resumes/"
    default_resume_path = "all resumes/default/resume.pdf"


# ── Stealth JS — masks all common headless/automation signals ─────────────────
_STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
window.chrome = { runtime: {} };
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) => (
    parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters)
);
"""

BROWSERLESS_ENDPOINT = "https://chrome.browserless.io/webdriver"


def _stealth_options() -> Options:
    """Build Chrome options with anti-detection flags."""
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-infobars")
    options.add_argument("--lang=en-US,en;q=0.9")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    )
    return options


def _inject_stealth(driver):
    try:
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": _STEALTH_JS},
        )
        print_lg("[Chrome] Stealth anti-detection script injected.")
    except Exception as e:
        print_lg(f"[Chrome] Warning: stealth injection failed (non-fatal): {e}")


def _install_chromium():
    """Install Chromium + chromedriver on Render (Ubuntu 24)."""
    print_lg("[Chrome] Installing Chromium on Render server...")
    try:
        subprocess.run(
            ["apt-get", "install", "-y", "chromium-browser", "chromium-chromedriver"],
            check=True, capture_output=True
        )
        print_lg("[Chrome] Chromium installed successfully.")
    except Exception:
        # Try snap or alternative paths
        try:
            subprocess.run(
                ["apt-get", "install", "-y", "chromium", "chromium-driver"],
                check=True, capture_output=True
            )
            print_lg("[Chrome] Chromium (alt package) installed successfully.")
        except Exception as e:
            print_lg(f"[Chrome] apt install failed: {e} — trying chromium-browser path directly")


def _find_chromedriver():
    """Find chromedriver binary path."""
    candidates = [
        "/usr/bin/chromedriver",
        "/usr/lib/chromium-browser/chromedriver",
        "/usr/lib/chromium/chromedriver",
        "/snap/bin/chromium.chromedriver",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    # Try which
    try:
        result = subprocess.run(["which", "chromedriver"], capture_output=True, text=True)
        if result.stdout.strip():
            return result.stdout.strip()
    except Exception:
        pass
    return None


def _find_chrome_binary():
    """Find Chrome/Chromium binary path."""
    candidates = [
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
        "/usr/bin/google-chrome",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    try:
        result = subprocess.run(["which", "chromium-browser"], capture_output=True, text=True)
        if result.stdout.strip():
            return result.stdout.strip()
        result = subprocess.run(["which", "chromium"], capture_output=True, text=True)
        if result.stdout.strip():
            return result.stdout.strip()
    except Exception:
        pass
    return None


def _create_local_session():
    """Launch a local Chromium session on the Render server."""
    print_lg("[Chrome] Starting local Chromium session on Render server...")

    # Install if not present
    if not _find_chromedriver():
        _install_chromium()

    chromedriver_path = _find_chromedriver()
    chrome_binary = _find_chrome_binary()

    if not chromedriver_path:
        raise RuntimeError(
            "chromedriver not found after installation attempt. "
            "Check Render build logs."
        )

    print_lg(f"[Chrome] Using chromedriver: {chromedriver_path}")
    if chrome_binary:
        print_lg(f"[Chrome] Using Chrome binary: {chrome_binary}")

    options = _stealth_options()
    options.add_argument("--headless=new")  # new headless mode (less detectable)
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-setuid-sandbox")
    options.add_argument("--remote-debugging-port=9222")

    if chrome_binary:
        options.binary_location = chrome_binary

    # Add residential proxy if configured
    proxy_url = os.environ.get("RESIDENTIAL_PROXY", "").strip()
    if proxy_url:
        options.add_argument(f"--proxy-server={proxy_url}")
        print_lg("[Chrome] Residential proxy configured.")
    else:
        print_lg("[Chrome] No proxy set — running without proxy.")

    service = Service(executable_path=chromedriver_path)
    driver = webdriver.Chrome(service=service, options=options)
    print_lg("[Chrome] Local Chromium session started successfully.")
    return driver


def _create_browserless_session():
    """Connect to Browserless.io cloud Chrome."""
    api_key = os.environ.get("BROWSERLESS_API_KEY", "")
    if not api_key:
        raise RuntimeError("BROWSERLESS_API_KEY is not set.")

    print_lg("[Browserless] Connecting to cloud Chrome at Browserless.io ...")
    options = _stealth_options()
    options.set_capability("browserless:token", api_key)
    options.set_capability("browserless:timeout", 300000)  # 5 min (paid plans only)

    proxy_url = os.environ.get("RESIDENTIAL_PROXY", "").strip()
    if proxy_url:
        options.add_argument(f"--proxy-server={proxy_url}")
        print_lg("[Browserless] Residential proxy configured.")
    else:
        print_lg("[Browserless] WARNING: No RESIDENTIAL_PROXY — LinkedIn may block datacenter IP.")

    driver = webdriver.Remote(
        command_executor=BROWSERLESS_ENDPOINT,
        options=options,
    )
    print_lg("[Browserless] Cloud Chrome session started successfully.")
    return driver


def createChromeSession(isRetry: bool = False):
    make_directories([
        file_name, failed_file_name,
        logs_folder_path + "/screenshots",
        default_resume_path,
        generated_resume_path + "/temp",
    ])

    use_local = os.environ.get("USE_LOCAL_CHROME", "").lower() in ("true", "1", "yes")
    has_browserless = bool(os.environ.get("BROWSERLESS_API_KEY", "").strip())

    if use_local or not has_browserless:
        print_lg("[Chrome] Mode: LOCAL Chromium (no session timeout, free)")
        driver = _create_local_session()
    else:
        print_lg("[Chrome] Mode: BROWSERLESS cloud Chrome")
        try:
            driver = _create_browserless_session()
        except Exception as e:
            print_lg(f"[Browserless] Failed: {e}\n[Chrome] Falling back to local Chromium...")
            driver = _create_local_session()

    _inject_stealth(driver)
    driver.set_page_load_timeout(120)
    driver.implicitly_wait(10)

    wait = WebDriverWait(driver, 30)
    actions = ActionChains(driver)
    return None, driver, actions, wait


try:
    options, driver, actions, wait = None, None, None, None
    options, driver, actions, wait = createChromeSession()

except Exception as e:
    msg = (
        "Failed to start Chrome session.\n\n"
        "If using Browserless: check BROWSERLESS_API_KEY.\n"
        "If using local Chrome: check Render build logs for Chromium install errors.\n"
        f"Error: {e}"
    )
    print_lg(msg)
    critical_error_log("In Opening Chrome Session", e)
    try:
        if driver:
            driver.quit()
    except Exception:
        pass
    exit(1)
