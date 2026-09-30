# Project: SMART APPLY Comprehensive Audit

## Architecture
- **Frontend**: React 19, TypeScript, Vite, React Router 7, Framer Motion, Monaco Editor, Lucide Icons, Web Audio API, Web Speech API (TTS/STT), HTML5 Canvas.
- **Backend**: FastAPI (Python 3.10), Motor & Beanie ODM (MongoDB Atlas), Redis (asyncio pub/sub & SlowAPI rate limiting), SlowAPI.
- **Deployment & Services**: Monolith (`app.main:app`) for local dev, 3-service split (`smartapply-core`, `smartapply-ai`, `smartapply-tools`) on Render.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Landing Page Cinematic Hero | 380vh scroll runway, split typography parallax, particle canvas, logo reveal, auto-play mode | M1, M2 | Survey (spec_miner, frontend) |
| 2 | Landing Page HUD Sandbox | 3D tilted card showcase with role switcher & 4 interactive tabs (ATS, Interview, LaTeX, Projects) | M1, M2 | Survey (spec_miner, frontend) |
| 3 | Landing Page Navigation & Content | Synchronized sticky navbar, 6 feature spotlights, workflow, security breakdown, FAQ accordion | M1, M2 | Survey (spec_miner, frontend) |
| 4 | Live Interview Pre-Call Setup | Web Audio mic tester (`useMicTester`), 5 track cards (HR, Tech, Behavioral, Exec, Creative) | M1, M2 | Survey (spec_miner, frontend) |
| 5 | Live Interview Audio Loop & Speech | Browser SpeechRecognition (STT), SpeechSynthesis (TTS) with neural voices | M1, M2 | Survey (spec_miner, frontend) |
| 6 | Live Interview Vision HUD | Canvas-based video frame analyzer for posture, eye contact, blinks, confidence score | M1, M2 | Survey (spec_miner, frontend) |
| 7 | Live Interview Monaco IDE | Sandboxed coding in Python/JS/TS/Java/C++ with Judge0 CE execution | M1, M2 | Survey (spec_miner, frontend, backend) |
| 8 | Live Interview Reporting Pipeline | Auto-disconnection, transcript caching, async LLM evaluation, Brevo email, report polling | M1, M2 | Survey (spec_miner, frontend, backend) |
| 9 | Auth & Session Management | JWT in httpOnly cookie (`sa_token`), OTP email verification, Redis pub/sub multi-tab sync | M1 | Survey (spec_miner, backend) |
| 10 | Resume Management & ATS Check | PDF upload to R2, PyMuPDF parsing, NVIDIA NIM ATS keyword scoring & feedback | M1 | Survey (spec_miner, backend) |
| 11 | Resume Tailor & LaTeX/HTML | Multimodal layout extraction, YtoTech sync compile, auto-apply email delivery | M1 | Survey (spec_miner, backend) |
| 12 | Tools & Resume Maker | Templates, LaTeX escaping, local `pdflatex` compilation, AI smart-fill | M1 | Survey (spec_miner, backend) |
| 13 | Jobs Search & Scoring | Adzuna/JSearch API integration, AI scoring against candidate profile | M1 | Survey (spec_miner, backend) |
| 14 | Project Recommender & Prompts | AI personalized project suggestions, phased engineering roadmaps, master prompt generator | M1 | Survey (spec_miner, backend) |
| 15 | LinkedIn Profile Optimizer | PDF profile extraction and AI recommendations | M1 | Survey (spec_miner, backend) |
| 16 | Career Chatbot & Stats | SSE streaming chat completion, dashboard statistics aggregation | M1 | Survey (spec_miner, backend) |
| 17 | SysAdmin Management | Metrics, user management, feature toggles, system settings, maintenance mode | M1 | Survey (spec_miner, backend) |
| 18 | Microservice Routing Alignment | Frontend client endpoint resolution vs backend router prefixes (`/code` vs `/code-execution`) | M1, M3 | Survey (frontend, backend) |
| 19 | Dynamic UI Audit: Landing Page | Live browser testing of rendering, interactions, styling, responsive layouts, console errors | M2, M3 | ORIGINAL_REQUEST R2 |
| 20 | Dynamic UI Audit: Live Interview | Live browser testing of kiosk layout, mic test, camera feed, STT/TTS, Monaco, call teardown | M2, M3 | ORIGINAL_REQUEST R2 |
| 21 | Bug Report Compilation | Full generation of `bug_report.md` adhering to all acceptance criteria | M3 | ORIGINAL_REQUEST R3 |
| 22 | Audit Verification & Gate | Independent verification by Reviewers, Challengers, and Forensic Auditor | M4 | System Prompt Gate |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Project Mapping | Map all features, architecture, and baseline requirements | none | DONE |
| M1 | Deep Static Codebase Audit | Comprehensive audit of all frontend and backend files for bugs, security issues, anti-patterns | M0 | IN_PROGRESS |
| M2 | Dynamic UI Testing | Start local app, dynamically audit Landing Page and Live Interview Page | M0 | IN_PROGRESS |
| M3 | Bug Report Compilation | Compile all findings into `d:\SMARTAPPLY\bug_report.md` | M1, M2 | PLANNED |
| M4 | Review, Challenge & Audit | Multi-agent review (2 Reviewers, 2 Challengers, 1 Forensic Auditor) | M3 | PLANNED |

## Code Layout
- Frontend Source: `d:\SMARTAPPLY\frontend\src\`
- Frontend Public Assets: `d:\SMARTAPPLY\frontend\public\`
- Backend App: `d:\SMARTAPPLY\backend\app\`
- Backend Microservices: `d:\SMARTAPPLY\backend\core\`, `d:\SMARTAPPLY\backend\ai\`, `d:\SMARTAPPLY\backend\tools\`
- Backend Tests: `d:\SMARTAPPLY\backend\tests\`
- Coordination & Agent State: `d:\SMARTAPPLY\.agents\teamwork\`
- Final Deliverable: `d:\SMARTAPPLY\bug_report.md`
