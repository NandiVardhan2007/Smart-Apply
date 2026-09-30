# Smart Apply

Smart Apply is an AI-powered job application assistant that streamlines applying to jobs: tailor resumes to a job description, check ATS compatibility, run voice AI mock interviews with a sandboxed coding stage, generate cover letters, and get project recommendations.

Live at **[smartapplies.app](https://smartapplies.app)**.

## Features

- **Resume Tailoring** — rewrite a LaTeX resume to fit a specific job description with AI, then export a PDF.
- **ATS Checker** — score a resume against a job description with actionable, section-level feedback.
- **Resume Maker** — build a resume from structured fields with AI smart-fill and PDF export.
- **Cover Letter Generator** — draft tailored cover letters from your profile and a target role.
- **Live Voice Interview Studio** — real-time voice mock interviews with an AI interviewer, Judge0 sandboxed code execution, facial-vision HUD telemetry, and a post-interview performance report.
- **Job Matching** — search live listings (JSearch) and rank them against your resume.
- **Project Recommender** — suggest projects and roadmaps based on your skills and target roles.
- **LinkedIn Optimizer** — AI feedback on your LinkedIn profile text.
- **AI Chatbot** — career Q&A assistant.

For architecture, data models, target audience, and future scope, see **[DOCUMENTATION.md](DOCUMENTATION.md)**.

## Architecture

Smart Apply is a monorepo with a React frontend and a FastAPI backend. For deployment the backend is split into **three independent web services** that share one `app/` package, so each can scale on its own:

| Service | Entrypoint | Routers |
|---------|-----------|---------|
| **core** | `backend/core/main.py` | auth, user, resume, projects, jobs, linkedin, admin, stats (+ WebSocket) |
| **ai**   | `backend/ai/main.py`   | ai, interview, tailor (+ WebSocket) |
| **tools**| `backend/tools/main.py`| resume_maker, cover_letter, code_execution, upload |

A monolithic `backend/app/main.py` mounts every router and is used for local development and the test suite. Redis backs WebSocket pub/sub across services; MongoDB Atlas (via Beanie ODM) is the datastore.

**Stack:** React 19 · TypeScript · Vite · framer-motion · FastAPI · Beanie/MongoDB · Redis · JWT (HS256) · slowapi.

**Integrations:** NVIDIA NIM (LLM) · Brevo (email OTP) · Judge0 CE via RapidAPI (code sandbox) · JSearch via RapidAPI (jobs) · Cloudflare R2 (file storage) · LaTeX/pdflatex (PDF export).

## Project structure

```
.
├── backend/
│   ├── app/            # shared FastAPI package: routers, models, services, websockets, config
│   ├── core/           # core web service entrypoint
│   ├── ai/             # ai web service entrypoint
│   ├── tools/          # tools web service entrypoint
│   ├── tests/          # pytest suite (mongomock, no live DB needed)
│   └── requirements.txt
├── frontend/           # React + Vite app (see frontend/README.md for the design system)
├── render.yaml         # Render blueprint (3 backend services + static frontend + redis)
├── .github/workflows/  # CI (backend pytest, frontend typecheck/test/build)
└── DOCUMENTATION.md
```

## Getting started

### Prerequisites
- Node.js 18+ (CI uses 20)
- Python 3.10+
- MongoDB (local or an Atlas URI) and Redis for the full experience

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in your keys (see below)
uvicorn app.main:app --reload --port 8000
```

`app.main` runs all routers in one process — convenient for local dev. To mirror production, run each service separately (`cd backend/core && uvicorn main:app --reload`, likewise for `ai` and `tools`).

### Frontend

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

## Environment variables

Secrets live only in `.env` files (git-ignored); only `.env.example` templates are committed. **Never commit a real `.env`.**

| Variable | Used by | Notes |
|----------|---------|-------|
| `SECRET_KEY` | all | JWT signing. Must be strong & unique in production. |
| `MONGODB_URI` / `MONGODB_DB_NAME` | all | MongoDB Atlas connection. |
| `REDIS_URL` | all | WebSocket pub/sub. |
| `NVIDIA_API_KEY` | core, ai, tools | LLM (NVIDIA NIM). |
| `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | core (OTP), ai | Email delivery. |
| `RAPIDAPI_KEY` | core | Job search (JSearch). |
| `JUDGE0_API_KEY` / `JUDGE0_API_HOST` / `JUDGE0_API_URL` | tools | Code execution sandbox. |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | core, tools | Cloudflare R2 file storage. |
| `LATEX_FALLBACK_URL` | ai, tools | Optional remote LaTeX render fallback. |
| `ENVIRONMENT` | all | `development` locally; set to `production` on deploy — this enables `assert_secure_config()`, which fails startup if `SECRET_KEY`/`MONGODB_URI`/`BREVO_API_KEY`/`NVIDIA_API_KEY` are left at defaults. |
| `FRONTEND_URL` | all | Allowed CORS origin. |

## Testing

```bash
# backend
cd backend && pytest --cov=app --cov-report=term-missing

# frontend
cd frontend && npx tsc --noEmit && npx vitest run && npm run build
```

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:
- **backend** — installs deps, spins up a Redis service, runs `pytest` with coverage (tests use `mongomock`, so no live database is required).
- **frontend** — `npm ci`, `tsc --noEmit`, `vitest run`, then `npm run build`.

## Deployment

Deployed on [Render](https://render.com) from `render.yaml` (Blueprint): the three Python web services, the static frontend, and a Redis instance. Values marked `sync: false` (all API keys, `MONGODB_URI`, R2 credentials) must be supplied in the Render dashboard — they are never stored in the repo. `SECRET_KEY` is generated once for `core` and shared to `ai`/`tools`. `ENVIRONMENT` is set to `production` for all backend services.

## License

MIT.
