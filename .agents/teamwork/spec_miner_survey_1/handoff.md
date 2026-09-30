# SMART APPLY — Comprehensive Specification & Requirement Audit Report

**Date**: 2026-09-30  
**Role**: Specification Miner (Survey Phase)  
**Corpus / Working Directory**: `d:\SMARTAPPLY\`  
**Handoff File**: `d:\SMARTAPPLY\.agents\teamwork\spec_miner_survey_1\handoff.md`  

---

## 1. Observation

Direct code and architectural observations across the repository:

### 1.1 Specification Sources & Core Directives
1. **`ORIGINAL_REQUEST.md`** (`d:\SMARTAPPLY\.agents\teamwork\ORIGINAL_REQUEST.md`):
   - Mandates a comprehensive code and UI audit of SMART APPLY with focus on bugs and issues, particularly on the **Landing Page** and **Live Interview Page**.
   - Requires generating `bug_report.md` in root directory with dedicated sections: "Landing Page UI Issues", "Live Interview Page UI Issues", and "General Codebase Issues".
2. **`README.md`** (`d:\SMARTAPPLY\README.md`):
   - Defines the product as an AI-powered job application assistant with resume tailoring, ATS checker, resume maker, cover letter generator, live voice interview studio, job matching, project recommender, LinkedIn optimizer, and AI chatbot.
   - Documents the hybrid deployment model: split into 3 independent web services (`core`, `ai`, `tools`) sharing `app/`, or runnable as a single monolith via `backend/app/main.py`.
3. **`DOCUMENTATION.md`** (`d:\SMARTAPPLY\DOCUMENTATION.md`):
   - Details target audience (software engineers, students/grads, career switchers, mid/senior job seekers).
   - Details data models (`User`, `Resume`, `InterviewReport`, `SystemSettings`, `APILog`, `ResumeTemplate`).
   - Details workflows for WebSockets with Redis pub/sub multi-tab synchronization, vision HUD telemetry, Judge0 sandbox, and NVIDIA NIM LLM inference.
4. **`render.yaml`** (`d:\SMARTAPPLY\render.yaml`):
   - Service `smartapply-core`: entry `backend/core/main.py`, routers `auth`, `user`, `resume`, `projects`, `jobs`, `linkedin`, `admin`, `stats`.
   - Service `smartapply-ai`: entry `backend/ai/main.py`, routers `ai`, `interview`, `tailor`, `jobs`.
   - Service `smartapply-tools`: entry `backend/tools/main.py`, routers `resume_maker`, `cover_letter`, `code_execution`, `upload`.
   - Service `smartapply-frontend`: static React SPA with rewrite `/*` -> `/index.html`.
   - Service `smartapply-redis`: internal Redis instance for pub/sub.

### 1.2 Router Discrepancies & Endpoint Mappings Observed
- In `backend/app/routers/code_execution.py`: line 32 declares `router = APIRouter(prefix="/api/code", tags=["Code Execution"])` with route `@router.post("/execute")`. Thus the full endpoint path is `/api/code/execute`.
- In `frontend/src/api/client.ts`: lines 51-57 state:
  ```typescript
  } else if (
    cleanEndpoint.startsWith('/resume-maker') ||
    cleanEndpoint.startsWith('/cover-letter') ||
    cleanEndpoint.startsWith('/code-execution') ||
    cleanEndpoint.startsWith('/upload')
  ) {
    baseUrl = import.meta.env.VITE_TOOLS_API_BASE_URL || ...
  ```
  `client.ts` expects `/code-execution`, but `LiveInterview.tsx` calls `apiFetch('/code/execute')` (line 189). Because `/code/execute` starts with `/code` and not `/code-execution`, `getApiBaseUrl` routes requests to `VITE_CORE_API_BASE_URL`. However, `code_execution.router` is mounted ONLY in `tools/main.py` (line 77) and NOT in `core/main.py`. In a multi-service deployment, `/code/execute` will fail with 404 Not Found.
- In `frontend/src/App.tsx`: lines 192-201 wrap `LiveInterview` in `<ProtectedRoute>` and `<Suspense>`, explicitly omitting `<DashboardLayout>`, because `LiveInterview` uses `.interview-layout` with `position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 9999;` (`frontend/src/styles/interview.css`, lines 6-18).
- In `frontend/src/api/client.ts`: lines 47-50 route `/jobs` to `VITE_AI_API_BASE_URL`. In `render.yaml` line 35, jobs variables are configured under `smartapply-core`, and `core/main.py` mounts `jobs.router`, while `ai/main.py` also mounts `jobs.router`.

---

## 2. Logic Chain

1. **Architecture & Decomposition**:
   - The system is architected as an asynchronous FastAPI backend and a React 19 / TypeScript / Vite frontend.
   - For local development, `backend/app/main.py` unites all 16 routers. For production, Render blueprint partitions the backend into `smartapply-core`, `smartapply-ai`, and `smartapply-tools`.
   - Authentication is shared across all services through a common JWT `SECRET_KEY` (HS256) and an httpOnly cookie (`sa_token`) with 30-day expiration.
   - Redis pub/sub (`sa:ws:events`) ensures state parity (e.g. OTP validation, login, logout) across multiple browser tabs and server instances.

2. **Landing Page Specifications & Design Constraints**:
   - The Landing page (`Landing.tsx` and `CinematicHeroSection.tsx`) must serve as both a high-impact branding showcase and an interactive sandbox.
   - It requires a sticky 380vh scroll runway driven by Framer Motion's `useScroll` and `useSpring`, with parallax split typography ("SMART" left, "APPLY" right), an interactive HTML5 canvas particle field, and floating violet ambient orbs.
   - An auto-play 7.5s cinematic cycle preview allows hands-free inspection of the hero transition.
   - The primary navigation bar remains hidden during the initial 2.5 screens of hero scrolling (`window.scrollY < window.innerHeight * 2.5`) and smoothly fades in once the user enters the product features overview.
   - The interactive product showcase (`TiltedCard`) enables instant role switching (Senior Backend, Staff Frontend, Lead DevOps) and demonstrates 4 core modules: Resume Tailor & ATS Scanner (keyword score, detected skills, missing skills, before/after bullet optimization), Live Mock Interview (speech synthesis audio waveform, Judge0 sandbox), LaTeX/PDF maker (structured forms and .tex source), and Portfolio Project Ideas (project overview and Cursor/v0 prompts).
   - Six functional capability spotlight cards, a 3-step workflow, an architecture/privacy breakdown, and an expandable 5-item FAQ accordion lead down to conversion CTAs.

3. **Live Interview Page Specifications & Design Constraints**:
   - The Live Interview Studio (`LiveInterview.tsx`) is a dedicated full-screen workstation (`position: fixed; inset: 0; z-index: 9999;`) decoupled from the standard dashboard sidebar.
   - Pre-interview setup enforces a Web Audio API microphone check (`AudioContext` + `AnalyserNode`) and specialization track selection (HR, Technical, Behavioral, Executive, Creative).
   - Real-time conversation combines Web Speech API synthesis (`window.speechSynthesis`) with neural voice selection (conversational rate 0.97, pitch 1.04) and continuous speech recognition (`webkitSpeechRecognition`).
   - Manual text input fallback ensures accessibility when voice input is unavailable.
   - Live Facial Vision HUD telemetry runs on an interval canvas sampler (160x120), extracting skin coverage, head center-of-gravity for posture/gaze tracking (Upright & Engaged, Leaning Left/Right/Forward), eye quadrant luminance delta for blink counts, and computing a dynamic confidence score (68%–98%).
   - Integrated Monaco code editor supports 5 languages (Python 3, JavaScript, TypeScript, Java 17, C++ 20) backed by sandboxed Judge0 CE execution (`/api/code/execute`).
   - Disconnection automatically flushes transcript logs to localStorage, queues asynchronous LLM evaluation (`/api/interview/analyze`), triggers an email delivery via Brevo, and redirects to the generated performance report (`/dashboard/live-interview/report/:roomName`).

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth | Public Settings | Retrieves maintenance mode, signup toggle, and announcement banner | None | JSON `{maintenance_mode, allow_new_signups, announcement_active, ...}` | Returns safe defaults if DB unset | `backend/app/routers/auth.py:47` |
| 2 | Auth | Email/Password Registration | Registers new candidate and generates 6-digit OTP | `SignupRequest` (`email`, `password`, `full_name`) | `MessageResponse` ("Account created...") | 403 if signups disabled, 409 if email exists, 429 if rate limited (>5/min) | `backend/app/routers/auth.py:68` |
| 3 | Auth | OTP Verification | Validates 6-digit OTP code within 10-minute window | `OtpVerifyRequest` (`email`, `otp_code`), session ID | `TokenResponse` (`access_token`, `user`), sets `sa_token` httpOnly cookie | 400 "Invalid or expired OTP", broadcasts `otp_failed` | `backend/app/routers/auth.py:112` |
| 4 | Auth | Candidate Login | Authenticates user; resends OTP if unverified | `LoginRequest` (`email`, `password`) | `TokenResponse`, sets `sa_token` cookie | 401 "Invalid email or password", 403 "Email not verified" + resends OTP | `backend/app/routers/auth.py:172` |
| 5 | Auth | Password Reset Workflow | Forgot-password request and OTP-based reset | `ForgotPasswordRequest`, `ResetPasswordRequest` | Generic message to prevent email enumeration | 400 on invalid/expired OTP | `backend/app/routers/auth.py:235` |
| 6 | Auth | Multi-Tab WebSocket Sync | Pushes real-time auth events across tabs via Redis pub/sub | WebSocket connection `/api/ws/auth/{session_id}` | Event frames (`otp_sent`, `login_success`, etc.) | Graceful teardown on disconnect; auto-reconnect supervisor | `backend/app/websockets/auth_ws.py`, `manager.py` |
| 7 | User | Profile Management | Read/update profile details (skills, education, experience, URLs) | `ProfileUpdateRequest` JSON | Updated user profile document | 401 unauthorized | `backend/app/routers/user.py:20` |
| 8 | User | Avatar Upload | Uploads profile photo to Cloudflare R2 bucket (`avatars/{id}`) | `multipart/form-data` image file (JPEG, PNG, WebP, GIF <= 10MB) | JSON `{message, url, key}` | 400 on invalid MIME/magic bytes or size >10MB | `backend/app/routers/upload.py:21` |
| 9 | User | Account Deletion | Cascading removal of user, R2 files, resumes, and interview reports | Authenticated DELETE | `MessageResponse` ("Account deleted successfully") | Storage errors caught safely during cleanup | `backend/app/routers/user.py:108` |
| 10 | Resume | Resume Upload & Ingestion | Parses PDF text via PyMuPDF (fitz), uploads to R2, triggers background AI parse | `multipart/form-data` PDF <= 10MB | JSON `{message, resume}` | 400 on non-PDF, image-only PDF, or file >10MB | `backend/app/routers/resume.py:25` |
| 11 | Resume | Resume Library Management | Lists user resumes, supports deletion with primary resume auto-promotion | `GET /api/resumes`, `DELETE /api/resumes/{id}` | Resumes array, deletion message | 400 invalid ID, 404 not found or unauthorized | `backend/app/routers/resume.py:108` |
| 12 | AI Resume | ATS Compatibility Check | Evaluates resume against job description for match score and keyword gaps | `resume_id` or `resume_file`, `job_description` | `AtsCheckResponse` (score, summary, strengths, keywords, section feedback) | 400 on missing inputs; falls back to score 0 without clobbering DB | `backend/app/routers/ai.py:35` |
| 13 | AI Resume | Resume Smart Parse | Extracts structured profile JSON (skills, bio, history) for onboarding | `resume_id` or `resume_file` | `ResumeParseResponse` | 400 on unparseable file | `backend/app/routers/ai.py:92` |
| 14 | Tailor | LaTeX Extraction | Transcribes resume PDF layout to LaTeX using NVIDIA multimodal vision LLM | `resume_id` | JSON `{latex_code}` | 404 not found, 502 on model extraction failure | `backend/app/routers/tailor.py:25` |
| 15 | Tailor | HTML/CSS Extraction | Extracts resume PDF layout into responsive HTML/CSS | `resume_id` | JSON `{html_code}` | 404 not found, 502 on extraction failure | `backend/app/routers/tailor.py:54` |
| 16 | Tailor | LaTeX Compilation | Compiles raw LaTeX string into vector PDF bytes | `CompileRequest` (`latex_code`) | Binary `application/pdf` stream | 422 if LaTeX source contains compilation errors | `backend/app/routers/tailor.py:87` |
| 17 | Tailor | Auto-Apply & Email | Applies recommendations to resume LaTeX, compiles, and emails PDF to user | `TailorRequest` (`resume_id`, `recommendations`, `custom_instructions`) | JSON `{message, latex_code, email_sent}` | 502 on failure; returns warning if email delivery fails | `backend/app/routers/tailor.py:100` |
| 18 | Tools | Cover Letter Generator | Generates tailored cover letter from resume context and job description | `resume_id` or `resume_file`, `job_description` | JSON `{cover_letter}` | 400 if job description missing, 500 on LLM failure | `backend/app/routers/cover_letter.py:23` |
| 19 | Tools | Resume Maker Templates | Lists templates and compiles user form data with LaTeX escaping | `template_id`, form data dictionary | Downloadable `resume.pdf` attachment | 400 invalid template ID, 500 compilation error | `backend/app/routers/resume_maker.py:64` |
| 20 | Tools | Resume Maker Smart Fill | Auto-populates template fields from existing resume or user profile | `template_id`, `resume_id` | JSON `{filled_data}` | 404 template not found, 502 on LLM failure | `backend/app/routers/resume_maker.py:233` |
| 21 | Tools | Judge0 Code Sandbox | Sandboxed execution of Python, JS, TS, Java, C++ via Judge0 CE API | `ExecuteRequest` (`language`, `code`, `stdin`) | `ExecuteResponse` (`stdout`, `stderr`, `exit_code`, `execution_time`) | 400 unsupported language, 400 code >50KB, 504 timeout | `backend/app/routers/code_execution.py:32` |
| 22 | Interview | Live Voice Studio Setup | Mic volume meter (Web Audio API) and 5 specialization tracks selection | Microphone stream, track selection | Live audio volume %, track card state | Graceful degradation if getUserMedia denied | `frontend/src/pages/dashboard/LiveInterview.tsx:106` |
| 23 | Interview | AI Interviewer Speech | Generates track-tailored follow-up questions and converts text to speech | `InterviewRespondRequest` (`theme`, `messages`, `target_role`) | JSON `{response, open_code_editor}` + Web Speech TTS | Fallback prompt if LLM call fails; Web Speech fallback | `backend/app/routers/interview.py:74` |
| 24 | Interview | Facial Vision HUD | Canvas-based video frame analyzer tracking posture, gaze, blinks, confidence | Video stream ref (160x120 canvas) | Telemetry HUD panel (emotion, confidence %, eye contact, posture, blinks) | Graceful default fallback on canvas capture failure | `frontend/src/pages/dashboard/LiveInterview.tsx:313` |
| 25 | Interview | Monaco In-Call Coding | Split-screen code editor with Judge0 execution and problem prompts | Language, source code | Console output, execution time, test status | Catches network / sandbox errors in UI | `frontend/src/pages/dashboard/LiveInterview.tsx:163` |
| 26 | Interview | Automated Report Analysis | Asynchronous LLM scoring of performance, grammar/communication mistakes | `AnalyzeRequest` (`user_id`, `room_name`, `transcript`, `telemetry`) | Creates `InterviewReport`, sends report email | Fallback heuristic report generated if LLM parse fails | `backend/app/routers/interview.py:168` |
| 27 | Interview | Performance Report UI | Displays score badge, telemetry stats, communication critique, improvements | `room_name` param | Interactive report cards & full transcript log | 3s polling until report finishes generating | `frontend/src/pages/dashboard/InterviewReport.tsx` |
| 28 | Jobs | Job Search & Match Scoring | Searches Adzuna/JSearch listings and scores against resume (50-100) | `query`, `location`, `resume_id` | JSON `{matches: [JobPosting]}` | Heuristic scoring fallback if LLM batch scoring fails | `backend/app/routers/jobs.py:16` |
| 29 | Projects | Project Recommender | Suggests 3 customized projects based on skills and availability | `skills`, `time_commitment`, `interests` | Array of project recommendation objects | 503 if model call fails or returns empty | `backend/app/routers/projects.py:25` |
| 30 | Projects | Project Roadmap Builder | Generates phased engineering roadmap with architecture and deliverables | `project_details`, preferences dict | JSON `{phases: [RoadmapPhase]}` | 503 if roadmap generation fails | `backend/app/routers/projects.py:44` |
| 31 | Projects | Idea Prompt Generator | Analyzes raw concepts and generates production Master Prompts for AI tools | `raw_idea`, target format (Cursor, v0, Bolt, etc.), answers | Master prompt string, architecture summary, downloadable file | 500 on LLM generation error | `backend/app/routers/ai.py:191`, `IdeaPromptGenerator.tsx` |
| 32 | LinkedIn | LinkedIn Profile Optimizer | Extracts profile text from PDF and suggests headlines, summary, experience | `multipart/form-data` profile PDF | JSON `{headline_suggestions, summary_rewrite, experience_improvements}` | 400 on non-PDF or empty file, 500 on failure | `backend/app/routers/linkedin.py:22` |
| 33 | Chatbot | Career Advisory Chatbot | Conversational career coaching with real-time SSE plain-text streaming | `ChatRequest` (`messages` array) | Token stream via `/ai/chat/stream` or reply via `/ai/chat` | Auto-fallback to non-streaming `/ai/chat` if stream breaks | `backend/app/routers/ai.py:133`, `AiChatbot.tsx` |
| 34 | Stats | User Dashboard Analytics | Aggregates stored resumes count, total interviews, and average ATS score | Authenticated user | JSON `{total_resumes, total_interviews, avg_ats_score, member_since}` | 500 on MongoDB aggregation error | `backend/app/routers/stats.py:11` |
| 35 | Admin | System Admin Dashboard | High-level metrics, 30-day timeline charts, ATS distribution, API call metrics | Admin JWT token | JSON stats and aggregation payloads | 403 Forbidden for non-admin users | `backend/app/routers/admin.py:17` |
| 36 | Admin | User & Entitlement Admin | Paginated user table, search regex, role update, feature toggles, CSV export | Admin JWT token, queries | User objects, CSV stream, mutation status | 400 on self-role change or self-deletion | `backend/app/routers/admin.py:28` |
| 37 | Admin | System Settings Admin | Toggles maintenance mode, signup lock, announcement banner | `SettingsUpdateRequest` | Updated settings; masks API key | 403 Forbidden for non-admin users | `backend/app/routers/admin.py:209` |
| 38 | Admin | Admin Template Creator | Uploads new resume templates with preview images and LaTeX code | `name`, `latex_code`, `required_fields`, image file | Created template document | 400 on non-image or invalid JSON fields | `backend/app/routers/resume_maker.py:72` |
| 39 | Landing | Cinematic Hero Parallax | Sticky 380vh scroll canvas with split typography, particles, violet orbs | Scroll progress (0 to 1) | Interpolated transforms, particle canvas, logo reveal | Smooth cubic easing and fallback explore scroll | `frontend/src/components/cinematic-hero/` |
| 40 | Landing | Interactive Showcase HUD | Live tabbed preview with role switcher (ATS, Voice, LaTeX, Projects) | Role and Tab selection | Reactive demo card with simulated live telemetry and code | Purely client-side demo state | `frontend/src/pages/Landing.tsx:375` |

---

## 4. Edge Cases Discovered

| # | Feature | Input / Condition | Observed Behavior |
|---|---------|-------------------|-------------------|
| 1 | API Client Microservices Routing | Request to `/code/execute` in `LiveInterview.tsx` | `client.ts:51` checks `cleanEndpoint.startsWith('/code-execution')`. Because the endpoint is `/code/execute`, it routes to `VITE_CORE_API_BASE_URL` instead of `VITE_TOOLS_API_BASE_URL`. In multi-service deployment, returns 404 Not Found. |
| 2 | Live Interview Layout Boundary | Route `/dashboard/live-interview` loaded in `App.tsx` | Wrapped in `<ProtectedRoute>` without `<DashboardLayout>` (unlike other dashboard pages) because `.interview-layout` uses `position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 9999;`. |
| 3 | Voice Interview Fallback | SpeechRecognition API missing or unsupported browser (e.g. Firefox) | Displays informational toast: "Voice recognition is best supported in Chrome, Edge, or Brave. You can also type your answers in the chat input." Candidate uses quick text input bar. |
| 4 | Vision HUD Canvas Errors | Camera feed video stream tainted, unmounted, or zero dimensions | Interval canvas `drawImage` wrapped in try/catch block (line 444 of `LiveInterview.tsx`); gracefully degrades to neutral telemetry (confidence 86%, Focused, Direct, Upright) rather than crashing UI. |
| 5 | Video Call Mute/Unmute | Candidate clicks microphone or video toggle | Directly disables audio/video `MediaStreamTrack` (`track.enabled = false`) and pauses/resumes SpeechRecognition so muted speech is never transcribed or sent to AI. |
| 6 | Technical Track Coding Trigger | AI interviewer returns text containing phrases like "write code", "code editor", "solve in the editor" | Backend `interview.py:110` detects trigger keywords and sets `open_code_editor: true`; frontend auto-opens the Monaco editor pane. |
| 7 | Interview Report Generation Lag | User navigates to `/dashboard/live-interview/report/:roomName` while LLM analysis is running | Shows spinning clock banner "AI Performance Analysis in Progress", renders cached transcript from `localStorage`, and polls `/interview/report/:roomName` every 3s until report is ready. |
| 8 | ATS Scoring Fallback | NVIDIA LLM call or JSON parsing fails during ATS check | Service returns fallback score 0 with empty keywords; `backend/app/routers/ai.py:79` detects fallback and refrains from saving score 0 to the database, preserving prior valid ATS score. |
| 9 | LaTeX Compilation Security | Untrusted candidate field values passed to Resume Maker | `_latex_escape` in `backend/app/routers/resume_maker.py:49` escapes all LaTeX control characters (`\`, `&`, `%`, `$`, `#`, `_`, `{`, `}`, `~`, `^`), and `pdflatex` executes with `-no-shell-escape` and `openin_any=p` in an isolated tempdir. |
| 10 | Primary Resume Deletion | User deletes their primary resume from the library | `backend/app/routers/resume.py:139` queries remaining resumes sorted by `-uploaded_at` and automatically promotes the most recently uploaded resume to `is_primary = True`. If no resumes remain, clears `user.resume_url`. |
| 11 | Account Deletion Cascade | User deletes account in Settings | `backend/app/routers/user.py:108` queries user's resumes, deletes stored PDF objects in Cloudflare R2 via `storage_service.delete_file`, deletes all `Resume` documents, deletes all `InterviewReport` documents, and finally deletes the `User` document. |
| 12 | System Maintenance Barrier | Administrator sets `maintenance_mode = True` in Admin Settings | In `frontend/src/App.tsx:142`, non-admin users attempting to visit any route are blocked by a full-screen "System Under Maintenance" overlay. Admin users bypass the block. |
| 13 | Admin Self-Demotion / Deletion | Admin user attempts to remove their own admin role or delete own account | Backend `admin.py:113` and `admin.py:143` reject requests with `400 Bad Request` ("Cannot change your own role" / "Cannot delete yourself"). |
| 14 | API Key Leakage Prevention | Admin retrieves system settings via `GET /api/admin/settings` | Stored `nvidia_nim_api_key` is stripped from response; returns only boolean `nvidia_nim_api_key_set = True/False`. |
| 15 | AI Chatbot Stream Failure | Upstream token stream drops or fails mid-generation | In `frontend/src/pages/dashboard/AiChatbot.tsx:77`, if streaming fails before any tokens arrive, client automatically falls back to non-streaming POST `/ai/chat`. |
| 16 | Rate Limiting Enforcement | Repeated requests to `/api/auth/login` or `/api/auth/signup` | SlowAPI enforces strict limits (e.g. 5/minute for login/signup, 3/minute for password reset, 10/minute for ATS check); responds with HTTP 429 Too Many Requests. |
| 17 | Frontend Test Environment (Node 22 / Vitest) | Running `npx vitest run` in `frontend/` under Node 22 | Fails with `TypeError: Cannot read properties of undefined (reading 'clear')` at `AuthContext.test.tsx:17:18` due to Node 22's experimental global `localStorage` colliding with JSDOM's `window.localStorage`. |

---

## 5. System Architecture, Environment Requirements & Dependencies

### 5.1 Architecture Overview
- **Frontend**: React 19 SPA, TypeScript, Vite, Framer Motion, Monaco Editor (`@monaco-editor/react`), Lucide React icons, Web Audio API, Web Speech API (TTS & STT), HTML5 Canvas.
- **Backend**: FastAPI (Python 3.10), Motor & Beanie ODM (MongoDB Atlas), Redis (asyncio pub/sub), SlowAPI (rate limiting with trusted proxy hop resolution).
- **Service Deployment Model**:
  1. **Monolith Mode** (`backend/app/main.py`): mounts all 16 routers on a single port (8000), used in local development and test suites.
  2. **3-Service Split Mode** (Render production blueprint):
     - `smartapply-core`: port $PORT, mounts `auth`, `user`, `resume`, `projects`, `jobs`, `linkedin`, `admin`, `stats`, plus `ws_router`.
     - `smartapply-ai`: port $PORT, mounts `ai`, `interview`, `tailor`, `jobs`, plus `ws_router`.
     - `smartapply-tools`: port $PORT, mounts `resume_maker`, `cover_letter`, `code_execution`, `upload`.
     - `smartapply-frontend`: static site hosting with client-side history rewrites (`/*` -> `/index.html`).
     - `smartapply-redis`: private Redis instance for WebSocket multi-tab event propagation.

### 5.2 External Dependencies & Integrations
1. **NVIDIA NIM (Llama 3.1 / 3.2)**:
   - Primary LLM inference engine (`https://integrate.api.nvidia.com/v1`).
   - Default text model: `meta/llama-3.1-70b-instruct` (or `meta/llama-3.2-11b-vision-instruct`).
   - Handles resume parsing, ATS scoring, voice interview dialogue generation, post-interview performance reports, project ideation, LinkedIn optimization, and chatbot.
2. **Brevo (formerly Sendinblue)**:
   - Transactional email service for OTP delivery, tailored resume PDF emailing, and post-interview performance report emailing.
   - Config: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`.
3. **Judge0 CE (Community Edition via RapidAPI)**:
   - Online sandboxed code execution runner (`https://judge0-ce.p.rapidapi.com`).
   - Isolated container execution with 10s runtime limit, 128MB RAM limit, no network access.
   - Supported languages: Python 3 (id 71), JavaScript Node.js (id 63), TypeScript (id 74), Java 17 (id 62), C++ 20 (id 54).
4. **Cloudflare R2**:
   - S3-compatible object storage for PDF resume uploads and candidate avatars (`smartapply-uploads`).
   - Config: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.
5. **Job Search Providers**:
   - Adzuna API primary (`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`).
   - JSearch via RapidAPI secondary (`RAPIDAPI_KEY`).
6. **Local / Remote LaTeX Distribution**:
   - Local `pdflatex` binary with `-no-shell-escape`.
   - Optional remote compile fallback via `LATEX_FALLBACK_URL`.

### 5.3 Environment Configuration & Security Verification
- `assert_secure_config()` executes at FastAPI startup: in non-development environments (`ENVIRONMENT != "development"`), fails immediately if `SECRET_KEY` is default, `MONGODB_URI` points to localhost, or `BREVO_API_KEY` / `NVIDIA_API_KEY` are empty.
- Security Headers HTTP Middleware: Enforces `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`.
- CORS Configuration: Restricts origins to `smartapplies.app`, `www.smartapplies.app`, `smartapply-frontend.onrender.com`, and localhost ports.

---

## 6. Specific Requirements: Landing Page & Live Interview Page

### 6.1 Landing Page Specification Matrix
1. **Cinematic Hero Runway (`CinematicHeroSection.tsx`)**:
   - Height: 360vh–400vh scroll runway (`select-none`, `#050308` background).
   - Sticky viewport: maintains fullscreen frame while user scrolls through scenes 1 to 7.
   - Scene 1–2: Centered geometric SmartApply logo with violet ambient glow and particle field.
   - Scene 3–4: Split typography animation where "SMART" translates left (`x: -180px`) and "APPLY" translates right (`x: +180px`), accompanied by heading drift and opacity drop.
   - Scene 5–6: Central radial vignette intensifies (`vignetteOpacity` up to 0.88) with expanding atmospheric violet glow.
   - Scene 7: Bottom CTA button reveal (`ctaOpacity` from 0 to 1, `ctaY` from 20 to 0).
   - Interactive autoplay button (7.5s animation loop using custom cubic easing and requestAnimationFrame).
2. **Dynamic Navbar Visibility**:
   - Must monitor `window.scrollY`. When scroll position exceeds hero track threshold (`window.innerHeight * 2.5`), `inHeroTrack` becomes false and the navbar slides in.
3. **Live Product Showcase HUD (`TiltedCard`)**:
   - 3D perspective tilt effect (`maxTilt={4}`, `glareEffect={true}`, `backdropFilter: blur(24px)`).
   - Window controls decoration (red, yellow, green dots).
   - Role switcher toolbar for 3 distinct engineering specs: Senior Backend, Staff Frontend, Lead DevOps.
   - 4 Interactive tabs:
     - `ats`: displays keyword alignment score circle (89%-95%), detected technical skills tags, missing skills tags, 4 structural checklist items, and side-by-side unoptimized vs tailored bullet points.
     - `interview`: audio waveform bar animation, spoken prompt preview, and Judge0 code editor with test status.
     - `latex`: structured form inputs and syntax-highlighted LaTeX source code.
     - `projects`: recommended portfolio project card and copyable Cursor/v0 build prompt.
4. **Content Sections**:
   - 6 Functional Capabilities Spotlight cards with hover lighting.
   - 3-Step Workflow ("01 Import Resume & Target Job", "02 Tailor Experience & Practice", "03 Export Clean LaTeX & Apply").
   - Technical Foundation & Security panel detailing FastAPI, Llama 3.1, Judge0 CE, and isolated storage.
   - FAQ Accordion with 5 collapsible panels and animated chevron rotations.
   - Conversion Banner and minimal footer with legal and documentation links.

### 6.2 Live Interview Page Specification Matrix
1. **Fullscreen Dedicated Shell (`interview-layout`)**:
   - Must break out of the standard dashboard navigation shell (`position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 9999;`).
2. **Pre-flight Setup & Device Verification**:
   - Web Audio API microphone check (`useMicTester` hook): requests `getUserMedia({ audio: true })`, maps frequency data to audio meter track (0–100%), and verifies `normalized > 5`.
   - Specialization Track Selection: 5 cards (HR & General Screen, Technical & Coding, Behavioral Leadership, Executive C-Suite, Creative & Design) with colored badge indicators and difficulty levels.
3. **Interactive Studio Header**:
   - Red pulsing dot with "LIVE SESSION ACTIVE" badge.
   - Monospace digital timer displaying elapsed call time (`MM:SS`).
   - Current specialization track pill.
   - Subtitles & transcript drawer toggle button showing message count badge.
   - Prominent red "End Call" button.
4. **AI Interviewer Stage**:
   - Central glowing orb avatar with 3 dynamic state animations:
     - `speaking`: pulsating orb ring, audio waveform bars, status "AI Interviewer Speaking...".
     - `listening`: steady glow, status "Candidate Turn — Speak into mic or type below".
     - `thinking`: spinning gradient ring, status "AI Evaluating & Synthesizing Question...".
5. **Speech Synthesis & Recognition Engine**:
   - Synthesis (TTS): Web Speech API `SpeechSynthesisUtterance`. Cleans markdown symbols (`*`, `_`, `#`, `` ` ``), selects natural human voice, sets conversational speed (0.97) and pitch (1.04).
   - Recognition (STT): `webkitSpeechRecognition` continuous mode (`lang: 'en-US'`). Displays live interim transcription in captions bar; dispatches final speech transcription to `/api/interview/respond`.
   - Quick text input bar: allows candidates in noisy environments or without mic access to type answers.
6. **Facial Vision HUD Telemetry**:
   - Hidden offscreen canvas (160x120) samples candidate video every 1200ms.
   - RGB/YCbCr skin color filter computes skin coverage percentage.
   - Eye quadrant luminance delta computes blink counts.
   - Head center of gravity checks posture (Upright, Leaning Left/Right, Leaning Forward, Reclined) and eye contact (Direct Optimal, Glancing Left/Right).
   - Generates confidence score (68%–98%) and emotion status.
   - Renders overlay HUD panel with telemetry values.
7. **Monaco Coding IDE Integration**:
   - Monaco code editor (`@monaco-editor/react`) embedded in split pane for Technical track.
   - Language selector: Python 3, JavaScript, TypeScript, Java 17, C++ 20 with boilerplate code.
   - "Execute" button proxies to Judge0 sandbox runner via `/code/execute` and displays STDOUT, STDERR, execution time, and exit code.
   - Fullscreen modal toggle and Problem Statement tab.
8. **Live Transcript Side Panel**:
   - Sliding drawer (`Framer Motion` spring animation) displaying timestamped conversation history with avatars.
9. **Disconnection & Report Pipeline**:
   - End Call cleans up media streams, cancels speech synthesis, and stops recognition.
   - Saves transcript array in `localStorage` (`sa_transcript_session-{timestamp}`).
   - Dispatches `POST /api/interview/analyze` with transcript and facial telemetry.
   - Automatically navigates candidate to `/dashboard/live-interview/report/:roomName`.
   - Report page polls every 3s until LLM evaluator finishes scoring final grade, grammar/communication mistakes, areas for improvement, and weaknesses.

---

## 7. Caveats

- **External API Keys**: Live execution of LLM inference (NVIDIA NIM), transactional email (Brevo), Judge0 sandbox (RapidAPI), and live job search (Adzuna/RapidAPI) require live API keys. In environments where keys are not supplied in `.env`, the system relies on built-in heuristic fallbacks (e.g. simulated job match scores, fallback interview dialogue, and fallback reports).
- **Browser Media Support**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) has full native support in Chromium-based browsers (Chrome, Edge, Brave), but limited or disabled-by-default support in Firefox and Safari. The application includes a fallback text input bar to accommodate non-Chromium environments.
- **LaTeX Binaries**: Local PDF compilation in `resume_maker.py` and `latex_service.py` requires a system `pdflatex` installation (e.g. TeX Live / MiKTeX) or a valid `LATEX_FALLBACK_URL`.

---

## 8. Conclusion

Smart Apply possesses a well-structured, modular codebase with 16 dedicated FastAPI routers, 7 backend service modules, 19 dashboard page components, and a custom cinematic landing experience. 

Key architectural strengths include:
1. Complete separation of concern between stateless core services, AI inference, and sandboxed code execution.
2. Comprehensive multi-tab synchronization via Redis pub/sub.
3. Resilient fallback design across all AI endpoints (ATS check preserves prior score on failure, job search falls back to heuristic matching, interview analysis generates backup reports).
4. Strict LaTeX sanitization and sandbox isolation preventing command injection.

A critical routing discrepancy was identified:
- **`frontend/src/api/client.ts:54`** checks `cleanEndpoint.startsWith('/code-execution')` for routing to `VITE_TOOLS_API_BASE_URL`, whereas `LiveInterview.tsx:189` calls `/code/execute` and `code_execution.py:32` defines prefix `/api/code`. In multi-service deployments, code execution requests are routed to `core` instead of `tools`, causing a 404 error.

---

## 9. Verification Method

To independently verify the discoveries documented in this report:

1. **Verify Backend Monolith and Split Routers**:
   - Inspect router inclusions in `backend/app/main.py` lines 83-97 (all 15 HTTP routers + 1 WebSocket router).
   - Inspect `backend/core/main.py` lines 79-86 (8 routers mounted).
   - Inspect `backend/ai/main.py` lines 79-82 (4 routers mounted).
   - Inspect `backend/tools/main.py` lines 75-78 (4 routers mounted).

2. **Verify Code Execution Routing Discrepancy**:
   - Inspect `frontend/src/api/client.ts` line 54: `cleanEndpoint.startsWith('/code-execution')`.
   - Inspect `frontend/src/pages/dashboard/LiveInterview.tsx` line 189: `apiFetch<CodeExecResponse>('/code/execute', ...)`.
   - Inspect `backend/app/routers/code_execution.py` line 32: `router = APIRouter(prefix="/api/code", ...)`.

3. **Verify Landing Page Runway & Scroll Trigger**:
   - Inspect `frontend/src/pages/Landing.tsx` line 198: `const heroThreshold = window.innerHeight * 2.5; setInHeroTrack(window.scrollY < heroThreshold);`.
   - Inspect `frontend/src/components/cinematic-hero/CinematicHeroSection.tsx` line 146: `h-[360vh] sm:h-[380vh] md:h-[400vh]`.

4. **Verify Live Interview Fullscreen & HUD Telemetry**:
   - Inspect `frontend/src/App.tsx` lines 192-201: `LiveInterview` mounted inside `<ProtectedRoute>` without `<DashboardLayout>`.
   - Inspect `frontend/src/styles/interview.css` lines 6-18: `.interview-layout` has `position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 9999;`.
   - Inspect `frontend/src/pages/dashboard/LiveInterview.tsx` lines 324-455: `FacialAnalysisHUD` canvas sampling logic.
   - Inspect `backend/app/routers/interview.py` lines 110-123: technical track code trigger auto-opening editor.

5. **Run Test Suites**:
   - Backend pytest suite:
     ```bash
     cd d:\SMARTAPPLY\backend
     pytest --cov=app --cov-report=term-missing
     ```
   - Frontend vitest suite:
     ```bash
     cd d:\SMARTAPPLY\frontend
     npx vitest run
     ```
