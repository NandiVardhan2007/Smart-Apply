"""
bot_service.py
Orchestrates LinkedIn Easy-Apply automation using the real runAiBot.py bot.
BOT_ENABLED=true  → real Selenium bot subprocess
BOT_ENABLED=false → simulation mode (safe demo without a browser)
"""

import asyncio
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from backend.config import BOT_ENABLED, OPENROUTER_KEYS, OPENROUTER_MODEL
from backend.database import get_db
from backend.email_utils import send_application_result_email

BOT_SRC    = Path(__file__).parent / "job_bot"
WORKSPACES = Path(os.path.expanduser("~")) / ".smartapply" / "workspaces"
WORKSPACES.mkdir(parents=True, exist_ok=True)

_sessions: dict = {}
_lock = threading.Lock()

# Files that must always be refreshed from BOT_SRC so any patches stay current
_ALWAYS_REFRESH = {"runAiBot.py"}


# ── Public API ────────────────────────────────────────────────────────────────

async def start_bot_session(user_id, user_email, platform, profile,
                            platform_accounts, job_prefs, resume_file_id):
    db = get_db()
    with _lock:
        if _sessions.get(user_id, {}).get("status") in ("running", "starting"):
            return

    doc = {
        "user_id": user_id, "platform": platform, "status": "starting",
        "started_at": datetime.now(timezone.utc),
        "jobs_applied": 0, "jobs_failed": 0, "log": [],
    }
    res = await db.bot_sessions.insert_one(doc)
    session_id = str(res.inserted_id)

    with _lock:
        _sessions[user_id] = {"status": "starting", "session_id": session_id, "platform": platform}

    async def _mark_failed(reason: str):
        """Mark the session as failed in both memory and DB."""
        with _lock:
            if user_id in _sessions:
                _sessions[user_id]["status"] = "failed"
        await db.bot_sessions.update_one(
            {"_id": res.inserted_id},
            {"$set": {"status": "failed", "ended_at": datetime.now(timezone.utc),
                       "error": reason}},
        )

    try:
        if BOT_ENABLED and platform == "linkedin":
            try:
                ws = await asyncio.to_thread(
                    _build_workspace, user_id, profile, platform_accounts, job_prefs, resume_file_id
                )
            except Exception as build_err:
                print(f"[bot_service] Workspace build failed for {user_id}: {build_err}")
                await _mark_failed(f"Workspace error: {build_err}")
                return

            await db.bot_sessions.update_one(
                {"_id": res.inserted_id}, {"$set": {"status": "running"}}
            )
            with _lock:
                _sessions[user_id]["status"] = "running"
            await asyncio.to_thread(_run_bot_process, user_id, ws, session_id, user_email)
        else:
            await db.bot_sessions.update_one(
                {"_id": res.inserted_id}, {"$set": {"status": "running"}}
            )
            with _lock:
                _sessions[user_id]["status"] = "running"
            await _simulate_bot(user_id, user_email, session_id, platform, job_prefs)

    except Exception as err:
        print(f"[bot_service] Unhandled error in start_bot_session for {user_id}: {err}")
        await _mark_failed(str(err))


async def stop_bot_session(user_id):
    """
    Stop the bot for the given user.
    Always clears stuck DB sessions (starting/running) even if nothing is in memory,
    so the frontend never stays in a permanent 'Starting' state.
    """
    db = get_db()
    had_session = False

    with _lock:
        session = _sessions.get(user_id)
        if session:
            had_session = True
            proc = session.get("process")
            if proc:
                try:
                    proc.terminate()
                except Exception:
                    pass
            _sessions[user_id]["status"] = "stopped"

    # Always update DB — clears any stuck "starting" or "running" rows.
    # Use find_one_and_update to avoid the invalid `sort` kwarg on update_one.
    await db.bot_sessions.find_one_and_update(
        {"user_id": user_id, "status": {"$in": ["running", "starting", "failed"]}},
        {"$set": {"status": "stopped", "ended_at": datetime.now(timezone.utc)}},
        sort=[("started_at", -1)],
    )
    return True   # Always return True so the frontend shows success


async def get_bot_status(user_id):
    db = get_db()
    with _lock:
        in_mem = {k: v for k, v in _sessions.get(user_id, {}).items() if k != "process"}

    latest = None
    async for doc in db.bot_sessions.find({"user_id": user_id}).sort("started_at", -1).limit(1):
        doc["_id"] = str(doc["_id"])
        for tf in ("started_at", "ended_at"):
            if hasattr(doc.get(tf), "isoformat"):
                doc[tf] = doc[tf].isoformat()
        latest = doc

    mem_status = in_mem.get("status")
    db_status  = latest["status"] if latest else "idle"

    # If DB says the bot is running/starting but there is no in-memory session
    # the server was restarted and the session is orphaned — treat it as idle.
    if not mem_status and db_status in ("running", "starting"):
        db_status = "idle"
        # Quietly clean it up so future calls are also correct
        await db.bot_sessions.find_one_and_update(
            {"user_id": user_id, "status": {"$in": ["running", "starting"]}},
            {"$set": {"status": "stopped", "ended_at": datetime.now(timezone.utc)}},
            sort=[("started_at", -1)],
        )

    effective_status = mem_status or db_status

    return {
        "status": effective_status,
        "platform": in_mem.get("platform") or (latest["platform"] if latest else None),
        "session": latest,
    }


# ── Workspace builder ─────────────────────────────────────────────────────────

def _build_workspace(user_id, profile, platform_accounts, job_prefs, resume_file_id=None):
    ws = WORKSPACES / user_id
    ws.mkdir(parents=True, exist_ok=True)

    # Copy / refresh bot source files (skip config/ — written fresh each time)
    for item in BOT_SRC.iterdir():
        if item.name in ("config", "all_excels", "logs"):
            continue
        dst = ws / item.name
        if item.is_dir():
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(item, dst, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        elif not dst.exists() or item.name in _ALWAYS_REFRESH:
            shutil.copy2(item, dst)

    # Required directories
    for d in ["all_excels", "logs", "logs/screenshots", "all resumes/default", "all resumes/temp"]:
        (ws / d).mkdir(parents=True, exist_ok=True)

    # Seed CSV headers only if files don't yet exist
    _CSV_HEADERS = {
        "applied_jobs.csv": (
            "Job ID,Title,Company,Work Location,Work Style,About Job,Experience required,"
            "Skills required,HR Name,HR Link,Resume,Re-posted,Date Posted,Date Applied,"
            "Job Link,External Job Link,Questions Found,Connect Request\n"
        ),
        "failed_jobs.csv": (
            "Job ID,Job Link,Resume Tried,Date listed,Date Tried,"
            "Assumed Reason,Stack Trace,External Job link,Screenshot Name\n"
        ),
    }
    for fname, header in _CSV_HEADERS.items():
        p = ws / "all_excels" / fname
        if not p.exists():
            p.write_text(header, encoding="utf-8")

    # Write config files
    cfg = ws / "config"
    cfg.mkdir(exist_ok=True)
    (cfg / "__init__.py").touch()
    _write_config(cfg, profile, platform_accounts, job_prefs)

    # Patch chromedriver path in open_chrome.py
    _patch_open_chrome(ws)

    # Copy user's resume PDF into workspace so the bot can upload it
    _copy_resume_to_workspace(ws, user_id, resume_file_id)

    return ws


def _write_config(cfg: Path, p: dict, platform_accounts: dict, jp: dict):
    """Write all six config/*.py files for the user."""
    ai_key = OPENROUTER_KEYS[0] if OPENROUTER_KEYS else ""

    # ── Enum sanitizers — fall back to safe defaults for unknown/junk values ──
    _ETHNICITY_VALS = {
        'Decline', 'Hispanic/Latino', 'American Indian or Alaska Native',
        'Asian', 'Black or African American',
        'Native Hawaiian or Other Pacific Islander', 'White', 'Other',
    }
    _GENDER_VALS      = {'Decline', 'Male', 'Female', 'Other'}
    _DISABILITY_VALS  = {'Decline', 'Yes', 'No'}
    _VETERAN_VALS     = {'Decline', 'Yes', 'No', 'I am not a protected veteran'}
    _CITIZENSHIP_VALS = {'US Citizen', 'Canadian Citizen', 'Green Card', 'H1B', 'L1', 'Other'}
    _VISA_VALS        = {'Yes', 'No'}

    def _enum(val, allowed, default='Decline'):
        v = str(val or '').strip()
        return v if v in allowed else default

    # ── personals.py ──────────────────────────────────────────────────────────
    (cfg / "personals.py").write_text(
        f"""\
first_name        = {_j(p.get('first_name', ''))}
middle_name       = {_j(p.get('middle_name', ''))}
last_name         = {_j(p.get('last_name', ''))}
phone_number      = {_j(p.get('phone_number', ''))}
current_city      = {_j(p.get('current_city', ''))}
street            = {_j(p.get('street', ''))}
state             = {_j(p.get('state', ''))}
zipcode           = {_j(p.get('zipcode', ''))}
country           = {_j(p.get('country', 'India'))}
ethnicity         = {_j(_enum(p.get('ethnicity'),         _ETHNICITY_VALS))}
gender            = {_j(_enum(p.get('gender'),            _GENDER_VALS))}
disability_status = {_j(_enum(p.get('disability_status'), _DISABILITY_VALS))}
veteran_status    = {_j(_enum(p.get('veteran_status'),    _VETERAN_VALS))}
""",
        encoding="utf-8",
    )

    # ── questions.py ─────────────────────────────────────────────────────────
    desired_salary = int(p.get("desired_salary") or 800000)
    current_ctc    = int(p.get("current_ctc") or 0)
    notice_period  = int(p.get("notice_period") or 0)
    (cfg / "questions.py").write_text(
        f"""\
default_resume_path        = "all resumes/default/resume.pdf"
years_of_experience        = {_j(str(p.get('years_of_experience', '0')))}
require_visa               = {_j(p.get('require_visa', 'No'))}
website                    = {_j(p.get('website', ''))}
linkedIn                   = {_j(p.get('linkedin_profile', ''))}
us_citizenship             = {_j(_enum(p.get('us_citizenship'), _CITIZENSHIP_VALS, 'Other'))}
desired_salary             = {desired_salary}
desired_salary_monthly     = {round(desired_salary / 12)}
desired_salary_lakhs       = {round(desired_salary / 100000, 2)}
current_ctc                = {current_ctc}
current_ctc_monthly        = {round(current_ctc / 12)}
current_ctc_lakhs          = {round(current_ctc / 100000, 2)}
notice_period              = {notice_period}
notice_period_months       = {round(notice_period / 30)}
notice_period_weeks        = {round(notice_period / 7)}
linkedin_headline          = {_j(p.get('linkedin_headline', ''))}
linkedin_summary           = {_safe_ml(p.get('linkedin_summary', ''))}
cover_letter               = {_safe_ml(p.get('cover_letter', ''))}
user_information_all       = {_safe_ml(p.get('user_information_all') or _build_user_info(p))}
recent_employer            = {_j(p.get('recent_employer', ''))}
confidence_level           = {_j(str(p.get('confidence_level', '7')))}
pause_before_submit        = False
pause_at_failed_question   = False
overwrite_previous_answers = True
""",
        encoding="utf-8",
    )

    # ── secrets.py ───────────────────────────────────────────────────────────
    # Prefer Gemini (direct) if a Gemini key is stored on the profile,
    # otherwise fall back to OpenRouter (openai-compatible).
    gemini_key   = p.get("gemini_api_key", "")
    gemini_model = (p.get("gemini_model") or "gemini-2.0-flash").strip()
    # Only allow known safe model names to prevent injection
    _ALLOWED_GEMINI_MODELS = {
        "gemini-2.0-flash-lite", "gemini-2.0-flash",
        "gemini-2.5-flash", "gemini-2.5-pro",
        "gemini-1.5-flash", "gemini-1.5-pro",
    }
    if gemini_model not in _ALLOWED_GEMINI_MODELS:
        gemini_model = "gemini-2.0-flash"
    if gemini_key:
        _ai_provider = "gemini"
        _llm_api_url = "https://generativelanguage.googleapis.com/v1beta/"
        _llm_api_key = gemini_key
        _llm_model   = gemini_model
        _llm_spec    = "gemini"
    else:
        _ai_provider = "openai"
        _llm_api_url = "https://openrouter.ai/api/v1/chat/completions"
        _llm_api_key = ai_key
        _llm_model   = OPENROUTER_MODEL
        _llm_spec    = "openai"

    (cfg / "secrets.py").write_text(
        f"""\
username          = {_j(platform_accounts.get('linkedin_email', ''))}
password          = {_j(platform_accounts.get('linkedin_password', ''))}
use_AI            = {bool(ai_key or gemini_key)}
ai_provider       = {_j(_ai_provider)}
llm_api_url       = {_j(_llm_api_url)}
llm_api_key       = {_j(_llm_api_key)}
llm_model         = {_j(_llm_model)}
llm_spec          = {_j(_llm_spec)}
stream_output     = False
showAiErrorAlerts = False
""",
        encoding="utf-8",
    )

    # ── search.py ────────────────────────────────────────────────────────────
    (cfg / "search.py").write_text(
        f"""\
search_terms             = {repr(jp.get('search_terms', ['Business Analyst']))}
search_location          = {_j(jp.get('search_location', 'India'))}
switch_number            = {int(jp.get('switch_number') or 15)}
randomize_search_order   = True
sort_by                  = {_j(jp.get('sort_by', 'Most recent'))}
date_posted              = {_j(jp.get('date_posted', 'Past month'))}
salary                   = ""
easy_apply_only          = True
experience_level         = {repr(jp.get('experience_level', ['Entry level']))}
job_type                 = {repr(jp.get('job_type', ['Full-time']))}
on_site                  = {repr(jp.get('on_site', ['On-site', 'Hybrid', 'Remote']))}
companies                = []
location                 = []
industry                 = []
job_function             = []
job_titles               = []
benefits                 = []
commitments              = []
under_10_applicants      = False
in_your_network          = False
fair_chance_employer     = False
pause_after_filters      = False
about_company_bad_words  = []
about_company_good_words = {repr(jp.get('good_words', []))}
bad_words                = {repr(jp.get('bad_words', []))}
security_clearance       = False
did_masters              = False
current_experience       = {int(p.get('years_of_experience') or 0)}
""",
        encoding="utf-8",
    )

    # ── settings.py ──────────────────────────────────────────────────────────
    (cfg / "settings.py").write_text(
        """\
close_tabs               = False
follow_companies         = False
run_non_stop             = True
alternate_sortby         = True
cycle_date_posted        = True
stop_date_cycle_at_24hr  = True
generated_resume_path    = "all resumes/"
file_name                = "all_excels/applied_jobs.csv"
failed_file_name         = "all_excels/failed_jobs.csv"
logs_folder_path         = "logs/"
click_gap                = 3
run_in_background        = False
disable_extensions       = False
safe_mode                = True
smooth_scroll            = True
keep_screen_awake        = False
stealth_mode             = False
showAiErrorAlerts        = False
""",
        encoding="utf-8",
    )

    # ── resume.py ────────────────────────────────────────────────────────────
    (cfg / "resume.py").write_text(
        'use_resume_generator = False\nresume_path = "all resumes/default/resume.pdf"\n',
        encoding="utf-8",
    )


def _copy_resume_to_workspace(ws: Path, user_id: str, resume_file_id: str | None):
    """
    Fetch the user's resume PDF from MongoDB GridFS (sync) and write it to
    the workspace at 'all resumes/default/resume.pdf' so the bot can upload it.
    Falls back gracefully if GridFS is unavailable or file_id is missing.
    """
    dest = ws / "all resumes" / "default" / "resume.pdf"
    dest.parent.mkdir(parents=True, exist_ok=True)

    if not resume_file_id:
        print(f"[bot_service] No resume_file_id — bot will use LinkedIn's previous upload.")
        return

    from pymongo import MongoClient
    import gridfs as sync_gfs          # PyMongo 4.x: import gridfs directly, not pymongo.gridfs
    from backend.config import MONGO_URI, DB_NAME

    client = None
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
        db = client[DB_NAME]
        fs = sync_gfs.GridFS(db, collection="resumes")
        file_obj = fs.get(ObjectId(resume_file_id))
        dest.write_bytes(file_obj.read())
        print(f"[bot_service] Resume copied to workspace: {dest}")
    except Exception as e:
        print(f"[bot_service] Could not copy resume (will use LinkedIn previous upload): {e}")
    finally:
        if client:
            client.close()


def _patch_open_chrome(ws: Path):
    """
    No patching needed — open_chrome.py now uses Browserless.io remote Chrome.
    The BROWSERLESS_API_KEY is passed via environment variable.
    """
    print("[bot_service] Using Browserless.io cloud Chrome — no local chromedriver needed.")

def _j(s) -> str:
    """json.dumps-safe single-line string for Python source output."""
    return json.dumps(str(s))


def _safe_ml(s) -> str:
    """Write a potentially multiline string safely as a Python quoted string."""
    escaped = (
        str(s)
        .replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\r", "")
        .replace("\n", "\\n")
    )
    return '"' + escaped + '"'


def _build_user_info(p: dict) -> str:
    parts = [("Name: " + p.get("first_name", "") + " " + p.get("last_name", "")).strip()]
    if p.get("linkedin_headline"):
        parts.append(p["linkedin_headline"])
    if p.get("skills_summary"):
        parts.append("Skills: " + p["skills_summary"][:400])
    if p.get("years_of_experience"):
        parts.append("Experience: " + str(p["years_of_experience"]) + " years")
    return " | ".join(parts)


# ── Real bot subprocess ───────────────────────────────────────────────────────

def _run_bot_process(user_id, ws, session_id, user_email):
    log_path = ws / "logs" / "log.txt"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    env["SMARTAPPLY_USER_ID"] = user_id
    # Pass Browserless.io API key so open_chrome.py can connect to cloud Chrome
    browserless_key = os.environ.get("BROWSERLESS_API_KEY", "")
    if browserless_key:
        env["BROWSERLESS_API_KEY"] = browserless_key

    # Write startup marker so the UI has something to show immediately
    with open(log_path, "a", encoding="utf-8", errors="replace") as f:
        f.write(f"\n{'='*60}\n")
        f.write(f"[SmartApply] Bot session starting at {datetime.now()}\n")
        f.write(f"[SmartApply] Workspace: {ws}\n")
        f.write(f"[SmartApply] User ID: {user_id}\n")
        f.write(f"{'='*60}\n\n")

    try:
        with open(log_path, "a", encoding="utf-8", errors="replace") as log_file:
            proc = subprocess.Popen(
                [sys.executable, "runAiBot.py"],
                cwd=str(ws),
                stdout=log_file,
                stderr=log_file,
                text=True,
                bufsize=1,
                encoding="utf-8",
                errors="replace",
                env=env,
            )
            with _lock:
                if user_id in _sessions:
                    _sessions[user_id]["process"] = proc
            exit_code = proc.wait()
            # Log the exit code so users can diagnose crashes
            with open(log_path, "a", encoding="utf-8", errors="replace") as f:
                f.write(f"\n[SmartApply] Bot process exited with code {exit_code}\n")
                if exit_code != 0:
                    f.write(f"[SmartApply] Non-zero exit — check above for errors (Chrome crash, login failure, etc.)\n")

    except Exception as e:
        print(f"[bot_service] Bot process error for user {user_id}: {e}")
        with open(log_path, "a", encoding="utf-8", errors="replace") as f:
            f.write(f"[SmartApply] LAUNCH ERROR: {e}\n")
    finally:
        _sync_csv_to_mongo(user_id, ws, session_id)
        with _lock:
            if user_id in _sessions:
                _sessions[user_id]["status"] = "completed"


def _sync_csv_to_mongo(user_id, ws, session_id):
    """
    Read applied/failed CSVs and upsert into MongoDB.
    Uses synchronous PyMongo — safe to call from a background thread.
    Motor (async) cannot be used here because it is bound to the main event loop.
    """
    # ObjectId imported at module level
    from pymongo import MongoClient
    from backend.config import MONGO_URI, DB_NAME

    client = None
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
        db = client[DB_NAME]

        for fname, result_val in [("applied_jobs.csv", "Applied"), ("failed_jobs.csv", "Failed")]:
            path = ws / "all_excels" / fname
            if not path.exists():
                continue
            with open(path, newline="", encoding="utf-8", errors="ignore") as f:
                for row in csv.DictReader(f):
                    job_id = (row.get("Job ID") or "").strip()
                    if not job_id:
                        continue
                    db.applications.update_one(
                        {"user_id": user_id, "job_id": job_id},
                        {"$set": {
                            "user_id": user_id,
                            "job_id": job_id,
                            "platform": "linkedin",
                            "job_title": row.get("Title", "Unknown"),
                            "company": row.get("Company", "Unknown"),
                            "job_link": row.get("Job Link") or row.get("External Job Link", ""),
                            "result": result_val,
                            "applied_at": datetime.now(timezone.utc),
                        }},
                        upsert=True,
                    )

        db.bot_sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"status": "completed", "ended_at": datetime.now(timezone.utc)}},
        )
        print(f"[bot_service] CSV sync complete for user {user_id}")

    except Exception as e:
        print(f"[bot_service] CSV sync error for user {user_id}: {e}")
    finally:
        if client:
            client.close()


# ── Simulation mode (BOT_ENABLED=false) ──────────────────────────────────────

async def _simulate_bot(user_id, user_email, session_id, platform, job_prefs):
    """Runs a fake bot session for demo/testing when BOT_ENABLED=false."""
    import random
    # ObjectId imported at module level

    db = get_db()
    sid = ObjectId(session_id)

    # Set up log file (same path the real bot uses) so the UI polling works
    ws = WORKSPACES / user_id
    log_path = ws / "logs" / "log.txt"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    def _write_log(line: str):
        with open(log_path, "a", encoding="utf-8", errors="replace") as f:
            f.write(line + "\n")

    _write_log(f"\n{'='*60}")
    _write_log(f"[SmartApply] SIMULATION mode — BOT_ENABLED=false")
    _write_log(f"[SmartApply] Session started at {datetime.now()}")
    _write_log(f"{'='*60}\n")

    JOBS = [
        ("Business Analyst", "Deloitte"), ("Data Analyst", "TCS"),
        ("Financial Analyst", "Wipro"), ("Marketing Analyst", "Infosys"),
        ("Operations Analyst", "Accenture"), ("HR Analyst", "HCL Technologies"),
        ("CRM Executive", "Salesforce India"), ("MIS Analyst", "KPMG"),
        ("Inside Sales Executive", "Zoho"), ("Junior Business Analyst", "Capgemini"),
        ("Data Analyst Intern", "Swiggy"), ("Business Operations", "Razorpay"),
    ]

    terms = (job_prefs.get("search_terms") or ["Business Analyst"])[:4]
    applied_count = failed_count = 0

    for term in terms:
        _write_log(f"\n>>>> Searching for \"{term}\" <<<<")
        related = [(t, c) for t, c in JOBS if any(w in t.lower() for w in term.lower().split())]
        jobs_for_term = related[:3] or random.sample(JOBS, 2)

        for job_title, company in jobs_for_term:
            with _lock:
                if _sessions.get(user_id, {}).get("status") == "stopped":
                    _write_log("\n[SmartApply] Bot stopped by user.")
                    return

            await asyncio.sleep(random.uniform(1.5, 3.5))

            result = random.choices(
                ["Applied", "Applied", "Applied", "Failed", "Skipped"],
                weights=[50, 20, 15, 10, 5],
            )[0]

            log_line = f"[{platform.upper()}] {result}: {job_title} at {company}"
            _write_log(log_line)

            await db.applications.insert_one({
                "user_id": user_id,
                "platform": platform,
                "job_title": job_title,
                "company": company,
                "result": result,
                "applied_at": datetime.now(timezone.utc),
            })

            if result == "Applied":
                applied_count += 1
                try:
                    await send_application_result_email(user_email, job_title, company, result)
                except Exception:
                    pass
            elif result == "Failed":
                failed_count += 1

            await db.bot_sessions.update_one({"_id": sid}, {
                "$push": {"log": log_line},
                "$set": {"jobs_applied": applied_count, "jobs_failed": failed_count},
            })

    _write_log(f"\n[SmartApply] Session complete — Applied: {applied_count}, Failed: {failed_count}")
    await db.bot_sessions.update_one(
        {"_id": sid},
        {"$set": {"status": "completed", "ended_at": datetime.now(timezone.utc)}},
    )
    with _lock:
        if user_id in _sessions:
            _sessions[user_id]["status"] = "completed"
