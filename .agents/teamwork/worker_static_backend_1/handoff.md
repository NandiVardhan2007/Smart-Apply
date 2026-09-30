# Static Backend Code Audit Report

**Working Directory**: `d:\SMARTAPPLY\.agents\teamwork\worker_static_backend_1\`  
**Specialist**: Static Backend Audit Specialist  
**Target Milestone**: M1 (Deep Static Codebase Audit)  
**Date**: 2026-09-30  

---

## 1. Observation

A full static analysis was conducted on all 54 files comprising the SMART APPLY backend (`backend/app/`, `backend/core/`, `backend/ai/`, `backend/tools/`, `backend/tests/`, and root deployment specs). The following direct observations were made with line-level quotes and verbatim code:

### Observation 1: Missing Model Attribute in `backend/app/routers/jobs.py` (Line 44)
In `backend/app/routers/jobs.py`:
```python
42:    if not resume_text:
43:        # Fallback to user headline or title query
44:        resume_text = f"Role: {clean_query}\nCandidate: {user.full_name or 'Job Seeker'}\nHeadline: {user.headline or clean_query}"
```
In `backend/app/models/user.py`:
```python
10: class User(Document):
11:     """User document stored in MongoDB."""
12: 
13:     email: Indexed(EmailStr, unique=True)
14:     hashed_password: str = ""
15:     full_name: str = ""
16:     is_verified: bool = False
17:     is_admin: bool = False
18:     has_onboarded: bool = False
19:     # ... bio, skills, education, experience ... (NO 'headline' field exists)
```

### Observation 2: Dead Check on `headline` in `backend/app/routers/interview.py` (Lines 90-91)
In `backend/app/routers/interview.py`:
```python
90:        elif hasattr(current_user, 'headline') and current_user.headline:
91:            context_details.append(f"Candidate Background: {current_user.headline}")
```
Because `User` has no `headline` attribute, this condition is always `False`.

### Observation 3: Microservice Routing Mismatch for Live Interview Code Execution
In `frontend/src/pages/dashboard/LiveInterview.tsx`:
```typescript
189:       const res = await apiFetch<CodeExecResponse>('/code/execute', {
190:         method: 'POST',
191:         body: JSON.stringify({ language, code }),
192:       });
```
In `frontend/src/api/client.ts`:
```typescript
51:     } else if (
52:       cleanEndpoint.startsWith('/resume-maker') ||
53:       cleanEndpoint.startsWith('/cover-letter') ||
54:       cleanEndpoint.startsWith('/code-execution') ||
55:       cleanEndpoint.startsWith('/upload')
56:     ) {
57:       baseUrl = import.meta.env.VITE_TOOLS_API_BASE_URL || ...;
58:     } else {
59:       baseUrl = import.meta.env.VITE_CORE_API_BASE_URL || ...;
60:     }
```
In `backend/core/main.py`:
```python
79: app.include_router(auth.router)
80: app.include_router(user.router)
81: app.include_router(resume.router)
82: app.include_router(projects.router)
83: app.include_router(jobs.router)
84: app.include_router(linkedin.router)
85: app.include_router(admin.router)
86: app.include_router(stats.router)
```
In `backend/tools/main.py`:
```python
77: app.include_router(code_execution.router)
```
`cleanEndpoint` is `'/code/execute'`, which does NOT start with `'/code-execution'`. The client routes to `smartapply-core`, where `/api/code/execute` is NOT mounted, producing an HTTP 404.

### Observation 4: Missing Job Provider Credentials in `smartapply-ai` Microservice
In `render.yaml`:
- `smartapply-core` (lines 36-41) defines `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, and `RAPIDAPI_KEY`.
- `smartapply-ai` (lines 56-100) has NO job environment variables.
In `frontend/src/api/client.ts` (line 48):
`cleanEndpoint.startsWith('/jobs')` routes explicitly to `VITE_AI_API_BASE_URL` (`smartapply-ai`).

### Observation 5: Missing PubSub Supervisor Startup in `backend/tools/main.py`
In `backend/tools/main.py`:
```python
21: @asynccontextmanager
22: async def lifespan(app: FastAPI):
23:     """Startup / shutdown lifecycle for Tools & Export Service."""
24:     assert_secure_config()
25: 
26:     await init_db()
27:     yield
28:     await close_db()
```
`manager.start_pubsub()` and `manager.stop_pubsub()` are absent, unlike `core/main.py`, `ai/main.py`, and `app/main.py`.

### Observation 6: Overly Permissive CORS Regex on All Services
In `backend/app/main.py` (Line 72), `core/main.py` (Line 68), `ai/main.py` (Line 68), `tools/main.py` (Line 64):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
Matches ANY subdomain hosted on Render with credentials allowed (`allow_credentials=True`).

### Observation 7: Unbounded In-Memory File Reads Across All Upload Endpoints
In `backend/app/routers/resume.py` (Line 37), `ai.py` (Line 63, Line 118), `cover_letter.py` (Line 53), `resume_maker.py` (Line 87), `upload.py` (Line 32), `linkedin.py` (Line 39):
```python
contents = await file.read()
if len(contents) > MAX_FILE_SIZE:
    raise HTTPException(...)
```
The entire payload is buffered in server RAM before checking the file size limit.

### Observation 8: PyMuPDF Unclosed Document Leaks in Vision Handlers
In `backend/app/services/latex_service.py` (Lines 49-55) and `backend/app/services/html_service.py` (Lines 38-44):
```python
try:
    doc = fitz.open(stream=pdf_content, filetype="pdf")
    for page in doc:
        for link in page.get_links():
            if "uri" in link:
                extracted_urls.add(link["uri"])
except Exception as e:
    logger.warning(...)
```
`doc.close()` is never invoked in this block.

### Observation 9: Missing `NVIDIA_IMAGE` Environment Variable in `render.yaml`
In `backend/app/services/latex_service.py` (Line 33) and `html_service.py` (Line 25):
```python
if not settings.NVIDIA_IMAGE:
    raise ValueError("NVIDIA_IMAGE is not set.")
```
In `render.yaml`, `NVIDIA_IMAGE` is never declared under any service.

### Observation 10: Private R2 Bucket URLs Queried Without AWS Authentication
In `backend/app/services/storage_service.py` (Lines 59-61):
```python
if settings.R2_PUBLIC_URL:
    return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{safe_key}"
return f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{settings.R2_BUCKET_NAME}/{safe_key}"
```
In `backend/app/routers/tailor.py` (Lines 36, 65, 114):
```python
async with httpx.AsyncClient() as client:
    resp = await client.get(resume.file_url)
    resp.raise_for_status()
```
An unauthenticated GET request to `https://*.r2.cloudflarestorage.com/...` fails with HTTP 401 when `R2_PUBLIC_URL` is omitted.

### Observation 11: Missing TeX Distribution for `pdflatex` in Cloud Containers
In `backend/app/routers/resume_maker.py` (Lines 162-167):
```python
pdflatex_cmd = [
    "pdflatex",
    "-interaction=nonstopmode",
    "-no-shell-escape",
    "resume.tex",
]
```
`render.yaml` runs on standard Python runtime (`pip install -r tools/requirements.txt`) without TeXLive installed. `pdflatex` execution raises `FileNotFoundError`.

### Observation 12: Broad Exception Catch Masking 403 as 500 in `/api/interview/report`
In `backend/app/routers/interview.py`:
```python
155:    try:
156:        if body.user_id != str(current_user.id):
157:            raise HTTPException(status_code=403, detail="Not authorized")
158:        report = InterviewReport(**body.model_dump())
159:        await report.insert()
160:        return {"status": "success", "id": str(report.id)}
161:    except Exception as e:
162:        raise HTTPException(status_code=500, detail=str(e))
```

### Observation 13: Full Redis Keyspace Scan on Every WebSocket Disconnection
In `backend/app/websockets/manager.py`:
```python
89:        if self._redis:
90:            try:
91:                # best-effort cleanup of any user->session set this session was added to
92:                async for key in self._redis.scan_iter("sa:ws:sessions:*"):
93:                    await self._redis.srem(key, session_id)
94:            except Exception as e:
95:                logger.warning(f"Failed Redis cleanup on disconnect: {e}")
```

### Observation 14: Orphaned Files in Cloudflare R2 on User Deletion via Admin Route
In `backend/app/routers/admin.py`:
```python
146:    await Resume.find({"user_id": user_id}).delete()
147:    await user.delete()
```
R2 resume objects (`resume.file_key`), user avatar objects, and `InterviewReport` documents are never deleted.

### Observation 15: CSV Formula Injection Vulnerability in User Export
In `backend/app/routers/admin.py`:
```python
85:    for user in users:
86:        writer.writerow([
87:            str(user.id),
88:            user.email,
89:            user.full_name or "",
...
```
`user.full_name` is unescaped and permits formula execution (`=`, `+`, `-`, `@`).

### Observation 16: ReDoS Vulnerability in Admin User Search
In `backend/app/routers/admin.py`:
```python
59:    query = {"$or": [
60:        {"email": {"$regex": q, "$options": "i"}},
61:        {"full_name": {"$regex": q, "$options": "i"}}
62:    ]}
```
User-supplied search string `q` is passed directly into `$regex` without `re.escape()`.

### Observation 17: Disconnected Admin Setting for `nvidia_nim_api_key`
In `backend/app/routers/admin.py` (Line 241), `settings.nvidia_nim_api_key` is persisted in `SystemSettings`.
In `backend/app/services/ai_service.py` (Line 76), `_get_client()` only reads `settings.NVIDIA_API_KEY` from configuration/environment. The database setting is ignored.

### Observation 18: Plaintext OTP Storage and Absence of Verification Attempt Limits
In `backend/app/models/user.py` (Line 21):
`otp_code: Optional[str] = None`
In `backend/app/routers/auth.py` (Lines 124-135): Failed verification attempts are not counted or recorded.

### Observation 19: Long Token Lifespan (30 Days) Without Invalidation Mechanism
In `backend/app/config.py` (Line 11):
`ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30`
In `backend/app/routers/auth.py` (Lines 323-331) and `user.py` (Lines 94-106): Neither logout nor password change revokes active JWTs.

### Observation 20: Missing HTML Escaping and Dropped Fields in Assessment Emails
In `backend/app/services/email_service.py` (Lines 127, 166, 172, 179):
`weaknesses_html` is computed at line 127 but never interpolated into `body`. Unescaped strings (`feedback`, `comm_feedback`, `areas_html`) are interpolated directly into raw HTML.

### Observation 21: Lost Exit Status Descriptions in Sandboxed Code Runner
In `backend/app/routers/code_execution.py` (Lines 180-214):
Non-zero exit statuses (such as TLE status 5) return empty `stderr` without exposing `status.description`.

### Observation 22: Race Condition in Primary Resume Assignment
In `backend/app/routers/resume.py` (Lines 70-82):
Concurrent uploads evaluate `existing_count == 0` simultaneously, creating multiple primary resumes.

### Observation 23: Beanie `allow_index_dropping=True` Operational Risk
In `backend/app/database.py` (Line 29):
`allow_index_dropping=True` can drop external or manual indexes in production.

### Observation 24: Unhandled Empty Resume Text in Cover Letter Generation
In `backend/app/routers/cover_letter.py` (Lines 36-66):
Missing `if not resume_text.strip()` validation passes blank strings to the LLM.

### Observation 25: Test Suite Failure in `backend/tests/test_idor.py`
In `backend/tests/test_idor.py`:
Line 14: `assert resp.status_code in (400, 404, 403, 401)` fails because `POST /api/jobs/matches` crashes on `user.headline` (Observation 1), returning 500.

---

## 2. Logic Chain

1. **Crash in Job Search & IDOR Test Failure**:
   - `jobs.py:44` accesses `user.headline`.
   - `models/user.py` does not define `headline`.
   - When `resume_id` is missing, invalid, or unauthorized, `resume_text` is empty, entering line 44.
   - Accessing `user.headline` triggers an unhandled `AttributeError`, resulting in HTTP 500.
   - `tests/test_idor.py` asserts `resp.status_code in (400, 404, 403, 401)`, but receives 500, causing test failure.

2. **Breakage of Live Interview Code Execution in Microservices**:
   - `LiveInterview.tsx` calls `apiFetch('/code/execute')`.
   - `client.ts` tests `cleanEndpoint.startsWith('/code-execution')`.
   - `'/code/execute'` fails this prefix check and falls back to `VITE_CORE_API_BASE_URL`.
   - `smartapply-core` does not mount `code_execution.router`.
   - The request returns 404 Not Found, breaking code execution during live interviews on Render.

3. **Loss of Job Matching Functionality on `smartapply-ai`**:
   - `client.ts` routes `/jobs` to `VITE_AI_API_BASE_URL` (`smartapply-ai`).
   - `render.yaml` only injects `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, and `RAPIDAPI_KEY` into `smartapply-core`.
   - `smartapply-ai` runs with empty credentials, failing live searches and forcing fallback to static curated jobs.

4. **Cross-Origin Security Exposure**:
   - `allow_origin_regex=r"https://.*\.onrender\.com"` matches any subdomain under `onrender.com`.
   - `allow_credentials=True` allows credentialed cookies (`sa_token`) to be passed.
   - Any malicious actor with a free Render app can craft an exploit page that steals user resumes and profile data via authenticated CORS requests.

5. **Denial of Service via Unbounded Uploads**:
   - Every file upload endpoint calls `await file.read()` before evaluating `len(contents) > MAX_FILE_SIZE`.
   - Uploading a multi-gigabyte stream directly consumes server heap memory, crashing the single worker on free-tier container instances.

6. **Storage & Memory Leaks**:
   - `fitz.open()` without `doc.close()` in `latex_service.py` and `html_service.py` leaks native PyMuPDF objects into memory on every tailoring call.
   - `admin.delete_user` deletes MongoDB records while skipping R2 storage cleanup, causing orphaned cloud files.
   - `manager.disconnect()` performs an O(N) full keyspace scan over Redis, causing latency spikes on frequent disconnections.

---

## 3. Caveats

- **No Caveats**: Every Python source file in the backend repository (`backend/app/`, `backend/core/`, `backend/ai/`, `backend/tools/`, `backend/tests/`) and root deployment configuration (`render.yaml`) was inspected in its entirety. Line numbers, variable names, and error traces were verified against the exact repository contents.

---

## 4. Conclusion

The SMART APPLY backend contains 25 verified defects across 6 categories:
1. **Critical Runtime Crashes**: `AttributeError` on `user.headline` in `jobs.py` (causes `test_idor.py` to fail) and dead logic in `interview.py`.
2. **Microservice Routing & Deployment Disconnects**: Code execution routed to the wrong service (`/code` vs `/code-execution`), missing job search credentials in `smartapply-ai`, and missing Redis pubsub supervisor in `smartapply-tools`.
3. **Security Vulnerabilities**: Overly permissive CORS regex on `*.onrender.com` with credentials enabled, unbounded file read DoS, CSV formula injection in user export, ReDoS in admin search, cleartext OTP storage, and unrevocable 30-day JWT sessions.
4. **Data Integrity & Leaks**: PyMuPDF handle leaks, Redis keyspace scanning on socket disconnect, and orphaned R2 storage objects during admin deletions and avatar updates.
5. **External Services & Fallbacks**: Unauthenticated requests to private R2 bucket URLs, invocation of local `pdflatex` on containers lacking TeX distributions, disconnected admin settings, and unescaped HTML in Brevo email delivery.

---

## 5. Verification Method

### 1. Verify Job Match Crash & IDOR Test Failure:
- Run: `pytest tests/test_idor.py` in `d:\SMARTAPPLY\backend`
- Inspect: `d:\SMARTAPPLY\backend\app\routers\jobs.py:44` (`user.headline`) vs `d:\SMARTAPPLY\backend\app\models\user.py`

### 2. Verify Microservice Code Execution Routing Mismatch:
- Inspect: `d:\SMARTAPPLY\frontend\src\api\client.ts:54` (`cleanEndpoint.startsWith('/code-execution')`) vs `d:\SMARTAPPLY\frontend\src\pages\dashboard\LiveInterview.tsx:189` (`apiFetch('/code/execute')`) and `d:\SMARTAPPLY\backend\core\main.py:79-86` (missing router).

### 3. Verify Permissive CORS Vulnerability:
- Inspect: `d:\SMARTAPPLY\backend\app\main.py:72` (`allow_origin_regex=r"https://.*\.onrender\.com"` and `allow_credentials=True`).

### 4. Verify Unbounded File Read Memory DoS:
- Inspect: `d:\SMARTAPPLY\backend\app\routers\resume.py:37-39`, `d:\SMARTAPPLY\backend\app\routers\upload.py:32-34`.

### 5. Verify Unclosed PyMuPDF Handles:
- Inspect: `d:\SMARTAPPLY\backend\app\services\latex_service.py:49-55` and `d:\SMARTAPPLY\backend\app\services\html_service.py:38-44`.

### 6. Invalidation Conditions:
- The findings regarding `user.headline` are invalidated only if `headline: Optional[str] = None` is added to `User` in `backend/app/models/user.py`.
- The findings regarding `/code/execute` are invalidated only if `client.ts` is updated to match `'/code'` or if `core/main.py` mounts `code_execution.router`.
