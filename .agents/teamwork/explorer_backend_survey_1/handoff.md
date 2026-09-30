# Backend Codebase Survey & Audit Report

**Author**: Backend Codebase Explorer (`explorer_backend_survey_1`)  
**Date**: 2026-09-30  
**Target Codebase**: `d:\SMARTAPPLY\backend\`  
**Scope**: Full survey of architecture, complete component inventory, live interview interaction flow, environment/dependencies, and preliminary bug/security hotspots.

---

## 1. Observation

### 1.1 Codebase File & Directory Tree Structure
The backend is structured as a Python FastAPI application capable of running as a monolith (`app.main:app`) or as 3 distinct microservices (`smartapply-core`, `smartapply-ai`, `smartapply-tools`):

```
backend/
├── .env / .env.example              # Environment variable definitions
├── pytest.ini                       # Pytest configuration (pythonpath = ., asyncio_mode = auto)
├── requirements.txt                 # Root dependencies (fastapi, motor, beanie, openai, etc.)
├── promote_admin.py                 # CLI utility to elevate user to admin in MongoDB
├── ai/
│   ├── .env.example
│   ├── main.py                      # smartapply-ai microservice entry point
│   └── requirements.txt
├── core/
│   ├── main.py                      # smartapply-core microservice entry point
│   └── requirements.txt
├── tools/
│   ├── main.py                      # smartapply-tools microservice entry point
│   └── requirements.txt
├── tests/
│   ├── conftest.py                  # Pytest fixtures (mongomock_motor, ASGITransport client)
│   ├── test_ai_service.py           # Unit tests for LLM JSON parsing
│   ├── test_auth.py                 # Integration tests for auth signup and rate limits
│   └── test_idor.py                 # IDOR regression test for resume access
└── app/
    ├── __init__.py
    ├── config.py                    # Pydantic Settings, environment schema, assert_secure_config
    ├── database.py                  # Motor AsyncIOMotorClient + Beanie init_beanie
    ├── main.py                      # Monolithic FastAPI app mounting all 15 routers + WebSockets
    ├── rate_limiter.py              # SlowAPI rate limiter with custom proxy hop resolver
    ├── middleware/
    │   ├── __init__.py
    │   ├── auth_middleware.py       # JWT cookie/header validator & session ID extractor
    │   └── admin_middleware.py      # Role-based access control (is_admin check)
    ├── models/
    │   ├── __init__.py
    │   ├── user.py                  # User Beanie document (collection: "users")
    │   ├── resume.py                # Resume Beanie document (collection: "resumes")
    │   ├── interview_report.py      # InterviewReport Beanie document (collection: "interview_reports")
    │   ├── settings.py              # SystemSettings Beanie document (collection: "system_settings")
    │   ├── api_metrics.py           # APILog Beanie document (collection: "api_logs", TTL 30 days)
    │   └── resume_template.py       # ResumeTemplate Beanie document (collection: "resume_templates")
    ├── schemas/
    │   ├── __init__.py
    │   ├── ai.py                    # ATS, chat, interview, idea prompt Pydantic models
    │   ├── auth.py                  # Signup, login, OTP, profile update Pydantic models
    │   └── profile.py               # EducationEntry, ExperienceEntry models
    ├── services/
    │   ├── __init__.py
    │   ├── ai_service.py            # NVIDIA NIM API calls, prompts, fallbacks, metrics
    │   ├── auth_service.py          # Bcrypt hashing & Python-Jose JWT encode/decode
    │   ├── email_service.py         # Brevo SMTP API, OTP emails, interview reports, PDF attachments
    │   ├── html_service.py          # PDF-to-HTML resume extraction & nh3 sanitization
    │   ├── job_service.py           # Adzuna API, RapidAPI JSearch, and curated fallbacks
    │   ├── latex_service.py         # PyMuPDF rendering, NVIDIA vision LaTeX extraction, YtoTech compilation
    │   └── storage_service.py       # Cloudflare R2 / S3 boto3 file storage & presigning
    ├── utils/
    │   ├── __init__.py
    │   └── pdf.py                   # PyMuPDF text extraction helper
    └── websockets/
        ├── __init__.py
        ├── auth_ws.py               # WebSocket endpoint /ws/auth/{session_id}
        └── manager.py               # Redis Pub/Sub WebSocket connection manager
```

---

### 1.2 Complete Inventory of Routes, Routers, Models, Middleware, and Services

#### Routers & Endpoints Table
Total endpoints across 15 routers: **38 HTTP routes + 1 WebSocket route + 1 Health Ping**.

| Router File | Prefix | HTTP Method | Endpoint Path | Auth Required | Description |
|---|---|---|---|---|---|
| `routers/auth.py` | `/api/auth` | GET | `/api/auth/public-settings` | No | Public maintenance & signup status |
| `routers/auth.py` | `/api/auth` | POST | `/api/auth/signup` | No | User registration & OTP generation |
| `routers/auth.py` | `/api/auth` | POST | `/api/auth/verify-otp` | No | OTP verification & JWT cookie creation |
| `routers/auth.py` | `/api/auth` | POST | `/api/auth/login` | No | Email/password login & JWT cookie |
| `routers/auth.py` | `/api/auth` | POST | `/api/auth/forgot-password` | No | Password reset OTP trigger |
| `routers/auth.py` | `/api/auth` | POST | `/api/auth/reset-password` | No | Password change with OTP verification |
| `routers/auth.py` | `/api/auth` | POST | `/api/auth/resend-otp` | No | Resend OTP code |
| `routers/auth.py` | `/api/auth` | POST | `/api/auth/logout` | No | Clear `sa_token` cookie |
| `routers/user.py` | `/api/user` | GET | `/api/user/profile` | Yes (`get_current_user`) | Retrieve full user profile & primary resume URL |
| `routers/user.py` | `/api/user` | PUT | `/api/user/profile` | Yes (`get_current_user`) | Update profile details (skills, bio, education, etc.) |
| `routers/user.py` | `/api/user` | PUT | `/api/user/settings/password` | Yes (`get_current_user`) | Change password with current password verification |
| `routers/user.py` | `/api/user` | DELETE | `/api/user/account` | Yes (`get_current_user`) | Delete user, R2 files, resumes, and interview reports |
| `routers/ai.py` | `/api/ai` | POST | `/api/ai/ats-check` | Yes (`get_current_user`) | ATS score calculation against job description |
| `routers/ai.py` | `/api/ai` | POST | `/api/ai/parse-resume` | Yes (`get_current_user`) | Extract profile fields from PDF using LLM |
| `routers/ai.py` | `/api/ai` | POST | `/api/ai/chat` | Yes (`get_current_user`) | Career counselor chat completion |
| `routers/ai.py` | `/api/ai` | POST | `/api/ai/chat/stream` | Yes (`get_current_user`) | Streaming chat completion response |
| `routers/ai.py` | `/api/ai` | POST | `/api/ai/interview/question` | Yes (`get_current_user`) | Generate single mock interview question |
| `routers/ai.py` | `/api/ai` | POST | `/api/ai/interview/evaluate` | Yes (`get_current_user`) | Evaluate candidate answer to question |
| `routers/ai.py` | `/api/ai` | POST | `/api/ai/idea/analyze` | Yes (`get_current_user`) | Clarification questions for project ideas |
| `routers/ai.py` | `/api/ai` | POST | `/api/ai/idea/generate-prompt` | Yes (`get_current_user`) | Generate master AI prompt (.cursorrules/markdown) |
| `routers/interview.py` | `/api/interview` | POST | `/api/interview/respond` | Yes (`get_current_user`) | Live interview turn response from AI recruiter |
| `routers/interview.py` | `/api/interview` | POST | `/api/interview/report` | Yes (`get_current_user`) | Direct save of raw report |
| `routers/interview.py` | `/api/interview` | POST | `/api/interview/analyze` | Yes (`get_current_user`) | Async queued analysis of interview & email report |
| `routers/interview.py` | `/api/interview` | GET | `/api/interview/reports` | Yes (`get_current_user`) | List interview reports for current user |
| `routers/interview.py` | `/api/interview` | GET | `/api/interview/report/{room_name}` | Yes (`get_current_user`) | Fetch report by room name |
| `routers/resume.py` | `/api/resumes` | POST | `/api/resumes` | Yes (`get_current_user`) | Upload resume PDF to R2 and extract text |
| `routers/resume.py` | `/api/resumes` | GET | `/api/resumes` | Yes (`get_current_user`) | List user's uploaded resumes |
| `routers/resume.py` | `/api/resumes` | DELETE | `/api/resumes/{resume_id}` | Yes (`get_current_user`) | Delete resume record and delete file from R2 |
| `routers/resume_maker.py` | `/api/resume-maker` | GET | `/api/resume-maker/templates` | Yes (`get_current_user`) | List resume templates |
| `routers/resume_maker.py` | `/api/resume-maker` | POST | `/api/resume-maker/templates` | Admin (`get_admin_user`) | Create template with preview image and LaTeX code |
| `routers/resume_maker.py` | `/api/resume-maker` | POST | `/api/resume-maker/templates/{id}/compile` | Yes (`get_current_user`) | Compile template with user data via local pdflatex |
| `routers/resume_maker.py` | `/api/resume-maker` | POST | `/api/resume-maker/templates/{id}/smart-fill` | Yes (`get_current_user`) | AI pre-fill of template fields from resume/profile |
| `routers/projects.py` | `/api/projects` | POST | `/api/projects/recommend` | Yes (`get_current_user`) | AI portfolio project recommendations |
| `routers/projects.py` | `/api/projects` | POST | `/api/projects/roadmap` | Yes (`get_current_user`) | AI step-by-step development roadmap |
| `routers/jobs.py` | `/api/jobs` | POST | `/api/jobs/matches` | Yes (`get_current_user`) | Search Adzuna/JSearch jobs and AI-score vs resume |
| `routers/linkedin.py` | `/api/linkedin` | POST | `/api/linkedin/optimize` | Yes (`get_current_user`) | Extract PDF profile & suggest optimizations |
| `routers/tailor.py` | `/api/tailor` | POST | `/api/tailor/extract-latex` | Yes (`get_current_user`) | Extract LaTeX from resume via NVIDIA vision |
| `routers/tailor.py` | `/api/tailor` | POST | `/api/tailor/extract-html` | Yes (`get_current_user`) | Extract styled HTML from resume via NVIDIA vision |
| `routers/tailor.py` | `/api/tailor` | POST | `/api/tailor/compile` | Yes (`get_current_user`) | Compile LaTeX to PDF via YtoTech |
| `routers/tailor.py` | `/api/tailor` | POST | `/api/tailor/auto-apply` | Yes (`get_current_user`) | Tailor resume, compile, and email PDF |
| `routers/cover_letter.py` | `/api/cover-letter`| POST | `/api/cover-letter/generate` | Yes (`get_current_user`) | Generate cover letter from resume & JD |
| `routers/code_execution.py`| `/api/code` | POST | `/api/code/execute` | Yes (`get_current_user`) | Execute Python/JS/TS/Java/C++ in Judge0 sandbox |
| `routers/upload.py` | `/api/upload` | POST | `/api/upload/avatar` | Yes (`get_current_user`) | Upload avatar image to Cloudflare R2 |
| `routers/stats.py` | `/api/stats` | GET | `/api/stats/dashboard` | Yes (`get_current_user`) | User dashboard metrics (counts, avg ATS score) |
| `routers/admin.py` | `/api/admin` | GET | `/api/admin/stats` | Admin (`get_admin_user`) | System-wide statistics |
| `routers/admin.py` | `/api/admin` | GET | `/api/admin/users` | Admin (`get_admin_user`) | Paginated user list |
| `routers/admin.py` | `/api/admin` | GET | `/api/admin/search` | Admin (`get_admin_user`) | User regex search |
| `routers/admin.py` | `/api/admin` | GET | `/api/admin/export/users` | Admin (`get_admin_user`) | CSV export of all users |
| `routers/admin.py` | `/api/admin` | PUT | `/api/admin/users/{id}/role` | Admin (`get_admin_user`) | Update user admin status |
| `routers/admin.py` | `/api/admin` | PUT | `/api/admin/users/{id}/features`| Admin (`get_admin_user`) | Toggle user feature entitlements |
| `routers/admin.py` | `/api/admin` | DELETE| `/api/admin/users/{id}` | Admin (`get_admin_user`) | Delete user & associated resumes |
| `routers/admin.py` | `/api/admin` | GET | `/api/admin/stats/timeline` | Admin (`get_admin_user`) | 30-day signup & upload timeline |
| `routers/admin.py` | `/api/admin` | GET | `/api/admin/settings` | Admin (`get_admin_user`) | Get system settings |
| `routers/admin.py` | `/api/admin` | PUT | `/api/admin/settings` | Admin (`get_admin_user`) | Update system settings |
| `routers/admin.py` | `/api/admin` | GET | `/api/admin/stats/resumes` | Admin (`get_admin_user`) | ATS score distribution breakdown |
| `routers/admin.py` | `/api/admin` | GET | `/api/admin/stats/api` | Admin (`get_admin_user`) | 14-day API latency and error metrics |
| `websockets/auth_ws.py` | `/api` | WS | `/api/ws/auth/{session_id}` | No (session ID key) | Auth event WebSocket (login, OTP sync) |
| `main.py` | None | GET/POST | `/ping` | No | Health check ping (`{"status": "ok"}`) |

#### Beanie ODM Models Inventory
1. **`User` (`app/models/user.py`)**:
   - Collection: `"users"`
   - Indexes: `"skills"`, `"created_at"`, unique index on `email`.
   - Fields: `email`, `hashed_password`, `full_name`, `is_verified`, `is_admin`, `has_onboarded`, `otp_code`, `otp_expires_at`, `profile_pic_url`, `resume_url`, `phone`, `bio`, `skills` (list), `linkedin_url`, `github_url`, `portfolio_url`, `education` (list[EducationEntry]), `experience` (list[ExperienceEntry]), `created_at`, `features` (dict[str, bool]).
2. **`Resume` (`app/models/resume.py`)**:
   - Collection: `"resumes"`
   - Indexes: `[("user_id", 1), ("is_primary", -1)]`, `"uploaded_at"`, `[("extracted_text", "text")]`.
   - Fields: `user_id` (`PydanticObjectId`), `filename`, `file_url`, `file_key`, `extracted_text`, `parsed_data`, `latex_code`, `html_code`, `is_primary` (bool), `ats_score` (Optional[int]), `uploaded_at`.
3. **`InterviewReport` (`app/models/interview_report.py`)**:
   - Collection: `"interview_reports"`
   - Indexes: `"user_id"` (Note: stores string).
   - Fields: `user_id` (`str`), `room_name` (`str`), `timestamp`, `questions_asked` (list[str]), `user_replies` (list[str]), `transcript` (list[dict]), `areas_for_improvement` (list[str]), `weaknesses` (list[str]), `telemetry_summary` (dict), `final_score` (`int`), `overall_feedback` (`str`), `communication_feedback` (`str`).
4. **`SystemSettings` (`app/models/settings.py`)**:
   - Collection: `"system_settings"`
   - Fields: `maintenance_mode` (`bool`), `allow_new_signups` (`bool`), `nvidia_nim_api_key` (`Optional[str]`), `announcement_active`, `announcement_message`, `announcement_type`, `updated_at`.
5. **`APILog` (`app/models/api_metrics.py`)**:
   - Collection: `"api_logs"`
   - Indexes: TTL Index on `timestamp` (expires after 30 days / 2592000s).
   - Fields: `timestamp`, `endpoint`, `response_time_ms`, `success`, `status_code`, `error_message`.
6. **`ResumeTemplate` (`app/models/resume_template.py`)**:
   - Collection: `"resume_templates"`
   - Fields: `name`, `description`, `image_url`, `latex_code`, `required_fields` (list[str]), `created_at`.

#### Middleware Inventory
1. **`auth_middleware.py`**:
   - `get_current_user`: extracts token from either `sa_token` cookie or `Authorization: Bearer <token>` header, decodes via JWT, verifies existence of user in MongoDB.
   - `get_session_id`: retrieves `x-session-id` header used for correlating HTTP auth requests with active WebSockets.
2. **`admin_middleware.py`**:
   - `get_admin_user`: depends on `get_current_user`, enforces `user.is_admin == True` (403 Forbidden on failure).
3. **Security Headers Middleware (`set_secure_headers` in `main.py`)**:
   - Injects `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`.
4. **Rate Limiting (`SlowAPI`)**:
   - `Limiter` in `rate_limiter.py` configured with `_client_ip`, extracting the IP `TRUSTED_PROXY_HOPS` from the right of `X-Forwarded-For` to prevent IP spoofing behind Render proxy. Backed by Redis.
5. **CORS Middleware**:
   - Whitelists production domains (`smartapplies.app`, `onrender.com`), plus `localhost:5173`, `5174`, `3000`, `8000`, `8001`, `8002` in development.

#### Services Inventory
1. **`ai_service.py`**: Manages client connection to NVIDIA NIM OpenAI-compatible API (`https://integrate.api.nvidia.com/v1`). Includes automatic fallback when models are deprecated/404 to `meta/llama-3.2-11b-vision-instruct`, background logging to `APILog`, robust markdown-stripped JSON parsing (`_parse_llm_json`), and token streaming (`chat_completion_stream`).
2. **`auth_service.py`**: Encapsulates `bcrypt.hashpw` and `bcrypt.checkpw`, plus JWT token generation (`create_access_token`) and decoding (`decode_access_token`).
3. **`email_service.py`**: Connects via `httpx` to Brevo SMTP REST API (`https://api.brevo.com/v3/smtp/email`). Generates 6-digit numeric OTPs via `secrets.choice`, sends HTML verification emails, interview assessment reports, and base64-encoded PDF attachments for tailored resumes.
4. **`html_service.py`**: Extracts resume text and embedded links using `fitz`, renders pages to PNG base64, invokes NVIDIA vision LLM to produce HTML/CSS, and sanitizes output using `nh3`.
5. **`job_service.py`**: Multi-tiered job search: primary provider is Adzuna API (with salary ranges and country parsing), secondary fallback is RapidAPI JSearch, and tertiary is `_get_curated_fallback_jobs`.
6. **`latex_service.py`**: PyMuPDF page rendering, vision-based LaTeX code extraction, and remote compilation via `https://latex.ytotech.com/builds/sync` with tenacity exponential backoff retries.
7. **`storage_service.py`**: Boto3 client wrapper for Cloudflare R2 object storage (`s3v4` signature). Implements `upload_file`, `get_file_url`, `generate_presigned_url`, and `delete_file`.
8. **`pdf.py`**: Synchronous helper extracting text from PDF bytes via `fitz.open(stream=..., filetype="pdf")`.

---

### 1.3 Live Interview Session Interaction Architecture

Contrary to superficial mentions in comments or `.env.example`, the live interview system does **NOT** use WebRTC streaming, server-side Whisper speech-to-text, or Groq voice APIs. The actual interaction architecture is:

1. **Client-Side Voice Processing (Speech-to-Text & Text-to-Speech)**:
   - **Speech-to-Text (STT)**: Fully client-side browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) in `LiveInterview.tsx` (lines 682–728).
   - **Text-to-Speech (TTS)**: Fully client-side browser Speech Synthesis API (`window.speechSynthesis.speak(new SpeechSynthesisUtterance(...))`) in `LiveInterview.tsx` (lines 564–628) with preferred natural human/neural voice selection.
   - **Zero Audio Streaming to Backend**: Audio bytes are never uploaded to the backend server during the conversation turns.
2. **Client-Side Facial HUD Telemetry Tracking**:
   - `useFaceAnalyzer` / canvas sampling loop in `LiveInterview.tsx` (lines 350–454) samples video frames every 1200ms using a hidden HTML canvas.
   - Uses YCbCr skin pixel filters, eye luminance variance (blink detection), and head centroid calculation to compute dynamic `confidenceScore`, `emotion`, `eyeContact`, `posture`, and `blinks`.
3. **Turn-by-Turn Conversational REST Flow**:
   - Candidate speaks or sends text -> `generateAIResponse` calls REST `POST /api/interview/respond`.
   - Payload: `{ theme, messages, participant_name, target_role, resume_summary }`.
   - Backend `interview.py` (lines 74–133) formats theme-specific recruiter prompt (`Technical`, `Behavioral`, `Executive`, `Creative`, `HR`), includes candidate context, and calls NVIDIA NIM LLM (`settings.NVIDIA_MODEL`).
   - If `theme == "Technical"` and the AI response mentions code triggers (e.g. `"write code"`, `"open the code editor"`), backend sets `"open_code_editor": True`.
   - Frontend receives response -> opens Monaco editor if requested -> speaks the response via Web Speech TTS.
4. **Live Code Execution**:
   - Embedded Monaco editor in `LiveInterview.tsx` (lines 185–214) submits code via REST `POST /api/code/execute`.
   - Backend `code_execution.py` proxies code to Judge0 Community Edition on RapidAPI (`https://judge0-ce.p.rapidapi.com`), enforcing timeouts and memory limits, and returns stdout/stderr/compilation errors.
5. **Post-Interview Analysis & Email Report Generation**:
   - Upon ending call (`handleDisconnect`), frontend calls REST `POST /api/interview/analyze` with `{ user_id, room_name, transcript, telemetry }`.
   - Backend acknowledges immediately with HTTP 202 Accepted, and enqueues `_run_llm_and_save` in FastAPI `BackgroundTasks`.
   - The background task calls NVIDIA NIM LLM to generate an evaluative JSON report assessing question answers, communication quality, and grammatical errors.
   - The result is parsed and inserted into MongoDB `interview_reports` collection.
   - Brevo email is triggered (`send_interview_report_email`) delivering a neo-brutalist assessment email to the candidate.
   - Frontend navigates to `/dashboard/live-interview/report/:roomName`, which polls `GET /api/interview/report/{room_name}` every 3 seconds until the background task completes.

---

### 1.4 Build & Run Scripts, Environment Requirements, Database Connections, and Dependencies

#### Build & Run Commands
- **Monolith Local Run**:
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  ```
- **Microservices Run (Render configuration in `render.yaml`)**:
  - Core API: `pip install -r core/requirements.txt && uvicorn core.main:app --host 0.0.0.0 --port $PORT`
  - AI Engine: `pip install -r ai/requirements.txt && uvicorn ai.main:app --host 0.0.0.0 --port $PORT`
  - Tools & Sandbox: `pip install -r tools/requirements.txt && uvicorn tools.main:app --host 0.0.0.0 --port $PORT`
- **Testing**:
  ```bash
  pytest
  ```

#### Environment Variables Schema (`app/config.py`)
- **Required outside development (`assert_secure_config`)**:
  - `SECRET_KEY`: JWT signing secret (cannot be default `"change-this-in-production"`).
  - `MONGODB_URI`: MongoDB connection string (cannot start with `mongodb://localhost`).
  - `BREVO_API_KEY`: Brevo email service key.
  - `NVIDIA_API_KEY`: NVIDIA NIM API key (`nvapi-...`).
- **Additional Service Credentials**:
  - `REDIS_URL`: Redis URI for WebSocket relay and rate limit storage (`redis://localhost:6379`).
  - `NVIDIA_MODEL`: Default LLM (`meta/llama-3.2-11b-vision-instruct`).
  - `NVIDIA_IMAGE` & `NVIDIA_IMAGE_MODEL`: API key and model for vision OCR in `html_service` and `latex_service`.
  - `ADZUNA_APP_ID` & `ADZUNA_APP_KEY`: Adzuna job search API credentials.
  - `RAPIDAPI_KEY`: RapidAPI key for JSearch fallback and Judge0 code execution.
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`: Cloudflare R2 object storage.
  - `JUDGE0_API_KEY`, `JUDGE0_API_HOST`, `JUDGE0_API_URL`: Judge0 sandbox configuration.
  - `LATEX_FALLBACK_URL`: Optional remote LaTeX render fallback endpoint.
  - `GROQ_API_KEY`: Declared in configuration, but unused in application logic.

#### Database Connections
- **MongoDB**: Initialized via Motor `AsyncIOMotorClient(settings.MONGODB_URI)` and bound to Beanie document models (`User`, `Resume`, `InterviewReport`, `SystemSettings`, `APILog`, `ResumeTemplate`).
- **Redis**: Initialized via `redis.asyncio.from_url(settings.REDIS_URL)` for pub/sub event broadcasting across workers, session-to-email mapping sets (`sa:ws:sessions:{email}`), and `SlowAPI` rate limit bucket storage.

---

## 2. Logic Chain

### 2.1 Critical Routing Failure for Live Interview Code Execution
1. **Observation**: `backend/app/routers/code_execution.py` line 32 defines `prefix="/api/code"` with endpoint `@router.post("/execute")`. The URL is `/api/code/execute`.
2. **Observation**: `frontend/src/api/client.ts` lines 52–60 contains:
   ```typescript
   } else if (
     cleanEndpoint.startsWith('/resume-maker') ||
     cleanEndpoint.startsWith('/cover-letter') ||
     cleanEndpoint.startsWith('/code-execution') ||
     cleanEndpoint.startsWith('/upload')
   ) {
     baseUrl = import.meta.env.VITE_TOOLS_API_BASE_URL || ...;
   } else {
     baseUrl = import.meta.env.VITE_CORE_API_BASE_URL || ...;
   }
   ```
3. **Observation**: `frontend/src/pages/dashboard/LiveInterview.tsx` line 189 calls `apiFetch<CodeExecResponse>('/code/execute', ...)`.
4. **Deduction**: `/code/execute` begins with `/code`, NOT `/code-execution`. It fails the `startsWith('/code-execution')` condition and falls through to the `else` branch, routing the request to `VITE_CORE_API_BASE_URL` (`smartapply-core`).
5. **Observation**: In `backend/core/main.py` lines 79–86, `smartapply-core` mounts only `auth`, `user`, `resume`, `projects`, `jobs`, `linkedin`, `admin`, and `stats`. It does NOT mount `code_execution.router`.
6. **Conclusion**: In any environment running the multi-service deployment (Render or staged microservices), all code execution calls from the Live Interview Studio fail with HTTP 404 Not Found.

### 2.2 Unhandled `AttributeError` Crash in `jobs.py`
1. **Observation**: `backend/app/routers/jobs.py` line 44 executes:
   ```python
   resume_text = f"Role: {clean_query}\nCandidate: {user.full_name or 'Job Seeker'}\nHeadline: {user.headline or clean_query}"
   ```
2. **Observation**: In `backend/app/models/user.py`, the `User` document model fields are `email`, `hashed_password`, `full_name`, `is_verified`, `is_admin`, `has_onboarded`, `otp_code`, `otp_expires_at`, `profile_pic_url`, `resume_url`, `phone`, `bio`, `skills`, `linkedin_url`, `github_url`, `portfolio_url`, `education`, `experience`, `created_at`, `features`. The attribute `headline` is not defined.
3. **Observation**: In `interview.py` line 90, the developer used `hasattr(current_user, 'headline') and current_user.headline`, but in `jobs.py` line 44, `user.headline` is accessed directly without defensive checks.
4. **Deduction**: When a candidate has no uploaded resume or an empty resume, accessing `user.headline` raises `AttributeError: 'User' object has no attribute 'headline'`.
5. **Conclusion**: Unauthenticated or resume-less job match requests trigger an unhandled 500 Internal Server Error.

### 2.3 Broken IDOR Protection Logic in `jobs.py`
1. **Observation**: In `backend/tests/test_idor.py`, the test asserts:
   ```python
   resp = await async_client.post("/api/jobs/matches", data={"query": "engineer", "resume_id": str(resume.id)}, headers={"Authorization": f"Bearer {token_a}"})
   assert resp.status_code in (400, 404, 403, 401)
   ```
2. **Observation**: In `backend/app/routers/jobs.py` lines 36–40:
   ```python
   if resume_id and resume_id.strip():
       try:
           resume = await Resume.get(PydanticObjectId(resume_id))
           if resume and resume.user_id == user.id:
               resume_text = resume.extracted_text or ""
       except Exception as e:
           logger.warning(f"Could not load resume {resume_id}: {e}")
   ```
3. **Deduction**: If `resume.user_id != user.id`, no exception is raised, no 403/404 is returned. The code silently falls through, uses fallback text, and returns HTTP 200 OK with matches.
4. **Conclusion**: The IDOR validation does not reject unauthorized requests, violating security expectations and failing `test_idor.py`.

### 2.4 Missing TeX Environment for `resume_maker.py`
1. **Observation**: `backend/app/routers/resume_maker.py` lines 162–182 executes `subprocess.run(["pdflatex", ...])`.
2. **Observation**: `backend/tools/requirements.txt` installs Python packages only. No LaTeX binary (`pdflatex` or `texlive`) is packaged or installed in Render's Python runtime.
3. **Observation**: In `latex_service.py` line 161, LaTeX compilation uses an external web service (`https://latex.ytotech.com/builds/sync`).
4. **Conclusion**: `resume_maker.py` will fail in cloud environments with `pdflatex command not found`, while `latex_service.py` functions via remote API, representing an ununified compilation architecture.

### 2.5 Data Retention Inconsistency Between Account Deletion and Admin Deletion
1. **Observation**: `backend/app/routers/user.py` (`delete_account`) explicitly fetches all user resumes, deletes each object from Cloudflare R2 (`storage_service.delete_file`), deletes resume documents, and deletes all `InterviewReport` documents.
2. **Observation**: `backend/app/routers/admin.py` (`delete_user`) executes only:
   ```python
   await Resume.find({"user_id": user_id}).delete()
   await user.delete()
   ```
3. **Conclusion**: When an admin deletes a user, physical PDF files in Cloudflare R2 and all `InterviewReport` documents remain orphaned in the database and cloud storage.

---

## 3. Caveats

1. **Local Test Execution Blocked by Missing Dependencies**: Direct synchronous execution of `pytest` in the current terminal failed because `mongomock_motor` is not installed in the global Python 3.11 environment. The project requires a virtual environment (`venv`) with `pip install -r requirements.txt`.
2. **External Cloud Services**: External services (Brevo, Cloudflare R2, NVIDIA NIM, Adzuna, Judge0, YtoTech) require valid API credentials; behavior under production credentials was analyzed via code inspection, exception handlers, and configuration schemas.
3. **Frontend Code References**: Frontend files were inspected strictly to verify API contract alignments (endpoints, payloads, and WebSocket URLs).

---

## 4. Conclusion

1. **Architectural Coherence**: The backend exhibits clean domain separation with 15 focused routers and unified Beanie models. However, the microservice split defined in `render.yaml` has divergence from the frontend API client routing.
2. **Live Interview Mechanics**: The live interview relies on client-side browser Web Speech APIs and canvas HUD telemetry rather than server-side audio/video streaming. Backend interaction during the call is strictly REST turn completions via NVIDIA NIM and Judge0 code execution.
3. **Key Hotspots Identified**:
   - `LiveInterview.tsx` -> `/code/execute` routes to Core API instead of Tools API due to mismatch in `client.ts` (`/code-execution` vs `/code`), causing 404 in production.
   - `jobs.py` line 44 references non-existent `user.headline`, causing 500 errors.
   - `jobs.py` silently ignores unauthorized `resume_id` instead of rejecting with 403/404.
   - `resume_maker.py` requires local `pdflatex` which is not present in standard cloud Python runtimes.
   - `admin.py` delete user endpoint fails to cascade deletions to Cloudflare R2 and `interview_reports`.
   - `NVIDIA_IMAGE` is missing from `render.yaml`, causing LaTeX/HTML resume extraction to throw `ValueError`.

---

## 5. Verification Method

1. **Verify Code Execution Microservice Routing**:
   - Inspect `frontend/src/api/client.ts` lines 52–56 and `backend/app/routers/code_execution.py` line 32.
   - Confirm that `cleanEndpoint.startsWith('/code-execution')` does NOT match `/code/execute`.
2. **Verify `user.headline` Bug**:
   - Inspect `backend/app/models/user.py` to confirm `headline` is not a declared field.
   - Inspect `backend/app/routers/jobs.py` line 44 to confirm direct attribute access `user.headline`.
3. **Verify IDOR Test Failure**:
   - Create a virtual environment, run `pip install -r requirements.txt`, and execute `pytest tests/test_idor.py`.
4. **Verify TeX Live Dependency in Tools**:
   - Check `backend/tools/requirements.txt` and `render.yaml` to confirm no OS-level TeX packages are installed for `smartapply-tools`.
5. **Verify Admin Delete Orphan Records**:
   - Compare `backend/app/routers/user.py` lines 117–128 with `backend/app/routers/admin.py` lines 146–148.
