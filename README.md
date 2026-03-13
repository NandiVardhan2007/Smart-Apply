# SmartApply 🤖

Fully automated job application platform — upload resume, configure profile, bot applies to LinkedIn/Indeed/Internshala/Naukri automatically.

## Quick Start

```bash
cd smartapply
pip install -r requirements.txt
python run.py
```

Open → http://localhost:8000  |  API docs → http://localhost:8000/api/docs

## Stack
- **Backend**: FastAPI + MongoDB Atlas + Motor async
- **Auth**: JWT + bcrypt (cost 12) + 6-digit PIN email verification
- **Storage**: GridFS (resumes), MongoDB (all user data)
- **Bot**: Selenium + undetected-chromedriver (from Startup.zip)
- **AI**: OpenRouter free models (keys from working_keys.json)
- **Resume**: pdfminer.six + custom regex parser (from Startup.zip)
- **Email**: SMTP (Gmail App Password)
- **Frontend**: Pure HTML/CSS/JS — no frameworks

## Configuration

Edit `.env` or `admin_config.json`:
- `SMTP_USER` / `SMTP_PASS` — Gmail app password for sending emails
- `BOT_ENABLED=true` — activates real Selenium (requires ChromeDriver)
- OpenRouter keys auto-loaded from `working_keys.json`

## Pages
| Page | URL |
|------|-----|
| Landing | `/` |
| Sign Up | `/signup.html` |
| Login | `/login.html` |
| Forgot Password | `/forgot-password.html` |
| Resume Upload | `/resume.html` |
| Profile Setup | `/profile.html` |
| Dashboard | `/dashboard.html` |
| Admin Panel | `/admin.html` |

## Project Structure
```
smartapply/
├── run.py                  ← python run.py to start
├── .env                    ← config
├── admin_config.json       ← SMTP + OpenRouter config
├── working_keys.json       ← OpenRouter API keys
├── requirements.txt
├── backend/
│   ├── main.py             ← FastAPI app entry point
│   ├── config.py           ← loads .env + admin_config.json
│   ├── database.py         ← Motor async + GridFS
│   ├── auth.py             ← JWT, bcrypt, session
│   ├── email_utils.py      ← SMTP: verify/reset/notifications
│   ├── resume_parser.py    ← regex parser (from Startup.zip)
│   ├── routers/
│   │   ├── auth.py         ← signup/verify/login/forgot/reset
│   │   ├── resume.py       ← PDF upload + pdfminer + GridFS
│   │   ├── profile.py      ← personal/prefs/platforms
│   │   ├── jobs.py         ← history/stats/bot control
│   │   ├── ai.py           ← OpenRouter cover letter + Q&A
│   │   └── admin.py        ← SMTP config, keys, users
│   ├── services/
│   │   ├── bot_service.py          ← workspace builder + subprocess
│   │   ├── openrouter_service.py   ← free AI integration
│   │   └── job_bot/                ← LinkedIn bot (from Startup.zip)
│   └── utils/
│       └── email_validator.py      ← disposable email blocking
└── frontend/
    ├── index.html      dashboard.html  signup.html  login.html
    ├── forgot-password.html  resume.html  profile.html  admin.html
    ├── css/main.css    ← full design system
    └── js/app.js       ← API client + helpers

## Key Features
- Email verification with 6-digit PIN (15 min expiry)
- Forgot password with secure token (1 hr expiry)
- Disposable email blocking (blacklist + MX DNS check)
- Rate limiting on all auth endpoints
- Multiple resume upload (GridFS) with label support
- Resume auto-parsing: name, phone, email, skills, experience, cover letter
- AI cover letter generation (OpenRouter free models)
- Per-user isolated bot workspace with dynamically generated config
- Bot session logging to MongoDB with live dashboard polling
- Email notifications on job application results
- Application history with pagination and result filtering
- Admin panel: SMTP live config, key management, user list

## Enabling Real Bot

```bash
# 1. Install ChromeDriver (match your Chrome version)
# 2. Set BOT_ENABLED=true in .env
# 3. Add LinkedIn credentials in Profile → Platform Logins
# 4. Click "Run Bot" on dashboard
```

Bot builds isolated workspace in ~/.smartapply/workspaces/{user_id}/,
writes per-user config/*.py, runs runAiBot.py as subprocess,
then syncs applied_jobs.csv + failed_jobs.csv results to MongoDB.
