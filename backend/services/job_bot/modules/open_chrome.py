'''
open_chrome.py — SmartApply (Browserless.io Cloud Edition)

Uses Browserless.io remote Chrome instead of a local browser.
Token is passed as a capability (NOT a query param) — this is the correct v1 method.
Set BROWSERLESS_API_KEY in your .env or Render environment variables.
'''

import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
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


# ── Browserless.io Configuration ──────────────────────────────────────────────

BROWSERLESS_ENDPOINT = "https://chrome.browserless.io/webdriver"


def _build_options() -> Options:
    api_key = os.environ.get("BROWSERLESS_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "BROWSERLESS_API_KEY is not set.\n"
            "Add it to your .env file or Render environment variables."
        )

    options = Options()

    # ✅ Correct way — pass token as capability, NOT as URL query param
    options.set_capability("browserless:token", api_key)

    options.add_argument("--no-sandbox")
    options.add_argument("--headless")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-infobars")
    options.add_argument("--lang=en-US,en;q=0.9")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    )

    return options


def createChromeSession(isRetry: bool = False):
    make_directories([
        file_name, failed_file_name,
        logs_folder_path + "/screenshots",
        default_resume_path,
        generated_resume_path + "/temp",
    ])

    print_lg("[Browserless] Connecting to cloud Chrome at Browserless.io ...")

    try:
        options = _build_options()
        driver = webdriver.Remote(
            command_executor=BROWSERLESS_ENDPOINT,
            options=options,
        )
        print_lg("[Browserless] Cloud Chrome session started successfully.")
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(
            f"Failed to connect to Browserless.io.\n"
            f"Check your BROWSERLESS_API_KEY and internet connection.\n"
            f"Error: {e}"
        )

    try:
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"},
        )
    except Exception:
        pass

    driver.set_page_load_timeout(90)
    driver.implicitly_wait(10)

    wait = WebDriverWait(driver, 15)
    actions = ActionChains(driver)
    return options, driver, actions, wait


try:
    options, driver, actions, wait = None, None, None, None
    options, driver, actions, wait = createChromeSession()

except Exception as e:
    msg = (
        "Failed to open Browserless.io Chrome session.\n\n"
        "Possible reasons:\n"
        "  1. BROWSERLESS_API_KEY is missing or invalid.\n"
        "  2. No internet connection on the server.\n"
        "  3. Browserless.io session limit reached (check your plan).\n\n"
        f"Error: {e}"
    )
    print_lg(msg)
    critical_error_log("In Opening Browserless Chrome", e)
    try:
        if driver:
            driver.quit()
    except Exception:
        pass
    exit(1)
