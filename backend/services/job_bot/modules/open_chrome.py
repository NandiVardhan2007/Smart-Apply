'''
open_chrome.py — SmartApply

Supports two modes:
1. LOCAL CHROME via selenium-manager (default, free, no timeout)
   Selenium 4.x auto-downloads Chrome + chromedriver via selenium-manager.
   No apt-get needed. Works on Render free tier.

2. BROWSERLESS (cloud) — set BROWSERLESS_API_KEY and USE_LOCAL_CHROME=false
   Uses Browserless.io. Free plan limited to 60s sessions (not enough).
   Only use if you have a paid Browserless plan.
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


# ── Stealth JS ────────────────────────────────────────────────────────────────
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


def _stealth_options(headless: bool = True) -> Options:
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
    if headless:
        options.add_argument("--headless=new")
    # Residential proxy
    proxy_url = os.environ.get("RESIDENTIAL_PROXY", "").strip()
    if proxy_url:
        options.add_argument(f"--proxy-server={proxy_url}")
        print_lg("[Chrome] Residential proxy configured.")
    else:
        print_lg("[Chrome] No RESIDENTIAL_PROXY set.")
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


def _install_chrome_via_selenium_manager():
    """
    Use Selenium Manager (built into selenium>=4.6) to auto-download
    Chrome + chromedriver. No apt-get required.
    """
    print_lg("[Chrome] Using Selenium Manager to auto-download Chrome...")
    try:
        import selenium.webdriver.common.selenium_manager as sm
        # Trigger selenium-manager to download chrome
        result = sm.SeleniumManager().binary_paths(["--browser", "chrome"])
        print_lg(f"[Chrome] Selenium Manager result: {result}")
        return result
    except Exception as e:
        print_lg(f"[Chrome] Selenium Manager direct call failed: {e}")
        return None


def _create_local_session():
    """
    Launch local Chrome using selenium-manager auto-download.
    Works on Render free tier — no apt-get, no pre-installed Chrome needed.
    """
    print_lg("[Chrome] Mode: LOCAL Chrome via Selenium Manager (free, no timeout)")

    options = _stealth_options(headless=True)
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-setuid-sandbox")
    options.add_argument("--remote-debugging-port=0")  # random port to avoid conflicts

    # selenium-manager auto-downloads Chrome + chromedriver on first run
    # Just create the driver — Selenium handles everything
    try:
        print_lg("[Chrome] Starting Chrome (selenium-manager will auto-download if needed)...")
        driver = webdriver.Chrome(options=options)
        print_lg("[Chrome] Local Chrome session started successfully!")
        return driver
    except Exception as e:
        print_lg(f"[Chrome] webdriver.Chrome() failed: {e}")
        raise


def _create_browserless_session():
    """Connect to Browserless.io cloud Chrome."""
    api_key = os.environ.get("BROWSERLESS_API_KEY", "")
    if not api_key:
        raise RuntimeError("BROWSERLESS_API_KEY is not set.")

    print_lg("[Browserless] Connecting to cloud Chrome at Browserless.io ...")
    options = _stealth_options(headless=False)  # Browserless is headless server-side
    options.set_capability("browserless:token", api_key)
    options.set_capability("browserless:timeout", 300000)

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

    use_local = os.environ.get("USE_LOCAL_CHROME", "true").lower() in ("true", "1", "yes")
    has_browserless = bool(os.environ.get("BROWSERLESS_API_KEY", "").strip())

    if use_local:
        driver = _create_local_session()
    elif has_browserless:
        try:
            driver = _create_browserless_session()
        except Exception as e:
            print_lg(f"[Browserless] Failed: {e}\n[Chrome] Falling back to local Chrome...")
            driver = _create_local_session()
    else:
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
        "Failed to start Chrome session.\n"
        f"Error: {e}\n\n"
        "Check that selenium>=4.6 is in requirements.txt (enables selenium-manager)."
    )
    print_lg(msg)
    critical_error_log("In Opening Chrome Session", e)
    try:
        if driver:
            driver.quit()
    except Exception:
        pass
    exit(1)
