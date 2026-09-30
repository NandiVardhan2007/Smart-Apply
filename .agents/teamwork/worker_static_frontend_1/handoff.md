# SMART APPLY — Comprehensive Static Frontend Audit Report

**Author**: Static Frontend Audit Specialist (`worker_static_frontend_1`)  
**Parent Orchestrator ID**: `5ae932e0-1e5d-4bb1-8ebb-a961d1408506`  
**Working Directory**: `d:\SMARTAPPLY\.agents\teamwork\worker_static_frontend_1\`  
**Target Codebase**: `d:\SMARTAPPLY\frontend\`  
**Date**: 2026-09-30T13:28:00Z  

---

## 1. Observation

Direct, verbatim code observations, line numbers, tool inspection findings, and configuration dumps across all frontend subsystems:

### 1.1 Root Build, Config, and Environment

1. **`d:\SMARTAPPLY\frontend\package.json` (lines 6–10, 20–22, 23–34)**:
   ```json
   "scripts": {
     "dev": "vite",
     "build": "tsc && vite build",
     "preview": "vite preview"
   },
   "devDependencies": {
     "@testing-library/jest-dom": "^6.9.1",
     "@testing-library/react": "^16.3.2",
     "@types/react": "^19.2.17",
     "@types/react-dom": "^19.2.3",
     "@vitejs/plugin-react": "^6.0.3",
     "jsdom": "^29.1.1",
     "typescript": "~6.0.2",
     "vite": "^8.1.0",
     "vitest": "^4.1.10"
   }
   ```
   - **Absence**: Neither `tailwindcss`, `@tailwindcss/vite`, `postcss`, nor `autoprefixer` is present anywhere in `devDependencies` or `dependencies`.
   - **Absence**: There is NO `"test"` script (e.g. `"test": "vitest run"`), despite `vitest`, `jsdom`, and `@testing-library/*` being installed.
   - **Absence**: There is NO `"lint"` script and NO ESLint packages installed.

2. **`d:\SMARTAPPLY\frontend\.env` vs `frontend\.env.example`**:
   - `d:\SMARTAPPLY\frontend\.env` content (26 bytes):
     ```
     ??????????????????????????
     ```
     Contains literal UTF-8 question mark byte sequence corruption.
   - `frontend\.env.example`:
     ```env
     VITE_CORE_API_BASE_URL=http://localhost:8001
     VITE_AI_API_BASE_URL=http://localhost:8002
     VITE_TOOLS_API_BASE_URL=http://localhost:8003
     ```

3. **`d:\SMARTAPPLY\frontend\vite.config.ts` (lines 4–19)**:
   ```typescript
   export default defineConfig({
     plugins: [react()],
     base: '/',
     server: {
       port: 5173,
       proxy: {
         '/api': {
           target: 'http://127.0.0.1:8000',
           changeOrigin: true,
           ws: true,
         },
       },
     },
   ```
   - Only proxy target configured is `/api` to port `8000`. No Tailwind plugin configured.

4. **`d:\SMARTAPPLY\frontend\src\{api,context,hooks,components,pages`**:
   - Directory listing:
     `d:\SMARTAPPLY\frontend\src\{api,context,hooks,components,pages\dashboard,styles}`
   - Shell brace expansion failed at creation time, leaving an empty, orphaned directory tree directly inside `src/`.

5. **`d:\SMARTAPPLY\frontend\public\` Asset Redundancy**:
   - `public/favicon.png`, `public/logo-512.png`, `public/logo.png`, `public/small_logo.png` are 4 byte-identical files of 611 KB each (totaling ~2.44 MB).
   - `public/favicon.svg` and `public/logo.svg` are 2 byte-identical files of 815 KB each (totaling ~1.63 MB).
   - Overall ~4.07 MB of duplicate static branding assets.
   - Directory `public/models/` does NOT exist in the repository, despite `@vladmandic/face-api` being installed and expected to load weights from `/models`.

---

### 1.2 Landing Page & Cinematic Hero Hotspots

1. **Tailwind Utility Classes Without Tailwind Compiler**:
   - `src/components/cinematic-hero/CinematicHeroSection.tsx`:
     - Line 146: `className="relative w-full bg-[#050308] text-[#F7F2FF] selection:bg-[#7209B7]/30"`
     - Line 149: `className="relative h-[360vh] w-full"`
     - Line 152: `className="sticky top-0 h-screen w-full overflow-hidden flex flex-col justify-between"`
     - Line 188: `className="text-xs uppercase tracking-[0.2em] font-mono text-[#E4C1F9]"`
     - Line 208: `className="mt-6 flex flex-wrap items-center justify-center gap-4"`
     - Line 248: `className="relative z-10 w-full max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6"`
   - `src/components/cinematic-hero/SmartApplyLogoReveal.tsx`:
     - Lines 86, 118, 146: Uses `text-2xl font-bold tracking-tight text-white`, `flex items-center gap-3`, etc.
   - `src/components/cinematic-hero/HeroPreview.tsx`:
     - Lines 9, 14: Uses `relative rounded-2xl border border-white/10 overflow-hidden bg-black/40 backdrop-blur-xl`.
   - `src/styles/index.css`:
     - Contains ONLY `@import './tokens.css'; @import './base.css'; @import './components.css'; @import './utilities.css'; @import './reactbits.css';`. No Tailwind directives exist.

2. **Dead Anchor in Navbar**:
   - `src/components/Navbar.tsx` (line 12):
     ```typescript
     { href: '#interview-studio', label: 'Voice Studio' },
     ```
   - `src/pages/Landing.tsx`:
     Grep search for `interview-studio` in `Landing.tsx` yields 0 matches. Existing IDs in `Landing.tsx` are `id="features"`, `id="demo"`, and `id="features-overview"`.

3. **Invisible Waveform in Mock Interview Sandbox**:
   - `src/pages/Landing.tsx` (lines 657–661):
     ```tsx
     <div className="waveform-container">
       {waveformBars.map((height, i) => (
         <div key={i} className="waveform-bar" style={{ height: `${height}%` }} />
       ))}
     </div>
     ```
   - Grep search across `src/styles/` for `.waveform-container` and `.waveform-bar`: 0 matches found in any stylesheet.
   - In `src/styles/interview.css`, the audio classes are `.audio-waveform` and `.audio-waveform-bar`, but `interview.css` is only imported inside `LiveInterview.tsx`.

4. **WebGL Context Recreation Thrash in GradientBlinds**:
   - `src/components/AnimatedBackground.tsx` (line 25):
     ```tsx
     <GradientBlinds ... gradientColors={['#FF9FFC', '#5227FF']} />
     ```
   - `src/components/reactbits/GradientBlinds.tsx` (lines 371–387):
     ```typescript
     useEffect(() => {
       ...
       const renderer = new Renderer({ ... });
       ...
       return () => {
         cancelAnimationFrame(animationFrameId);
         window.removeEventListener('resize', resize);
         if (ctn && gl.canvas && ctn.contains(gl.canvas)) {
           ctn.removeChild(gl.canvas);
         }
         gl.getExtension('WEBGL_lose_context')?.loseContext();
       };
     }, [..., gradientColors, ...]);
     ```
     `gradientColors` is passed as an inline array literal `['#FF9FFC', '#5227FF']` without `useMemo`. Every re-render of `AnimatedBackground` passes a new object reference, destroying and creating the OGL WebGL context.

5. **Missing Keyframes & Disabled Pointer Events in Reactbits**:
   - `src/components/reactbits/StarBorder.tsx` (line 46):
     ```typescript
     animation: `starBorderSpin ${speed} linear infinite`,
     ```
     Grep for `starBorderSpin`: 0 definitions across all CSS files.
   - `src/components/reactbits/AuroraBackground.tsx` (lines 116–123, 152, 167, 182, 198):
     - Line 118: `pointerEvents: 'none'` applied to outer container having `onMouseMove={handleMouseMove}`.
     - Lines 152, 167, 182, 198: Uses `auroraFloat1 18s ease-in-out infinite alternate`, `auroraFloat2`, `auroraFloat3`, `auroraPulse`.
     - Grep for `auroraFloat` / `auroraPulse`: 0 definitions across all CSS files.
   - `src/styles/reactbits.css` (line 47):
     ```css
     --spotlight-color: rgba(var(--accent-rgb), 0.18);
     ```
     Grep for `--accent-rgb`: 0 definitions in `tokens.css` or any other CSS file (only `--accent: #7c3aed;`).

6. **Synchronous Layout Thrashing in SquaresBackground**:
   - `src/components/reactbits/SquaresBackground.tsx` (lines 76–78):
     ```typescript
     const draw = () => {
       ...
       const computedStyle = getComputedStyle(document.documentElement);
       ...
       animationFrameRef.current = requestAnimationFrame(draw);
     };
     ```
     `getComputedStyle()` forced layout calculation runs inside `requestAnimationFrame` on every single render frame (60–144 Hz).

7. **Dead "Copy Prompt" Element**:
   - `src/pages/Landing.tsx` (line 811):
     ```tsx
     <span className="copy-badge">📋 Copy Prompt</span>
     ```
     Element is a plain `<span>` with no `onClick` handler, no clipboard action, and no cursor pointer style.

---

### 1.3 Live Interview & Speech/Vision Subsystem

1. **Acoustic Feedback Infinite Loop (Echo Cancellation Failure)**:
   - `src/pages/dashboard/LiveInterview.tsx` (lines 690–713):
     ```typescript
     recognition.onresult = (event: SpeechRecognitionEvent) => {
       let interim = '';
       for (let i = event.resultIndex; i < event.results.length; i++) {
         const transcript = event.results[i][0].transcript;
         if (event.results[i].isFinal) {
           setMessages((prev) => [...prev, { role: 'user', content: transcript, timestamp: Date.now() }]);
           generateAIResponse(transcript);
         }
       }
     };
     ```
     `SpeechRecognition` continues listening while `window.speechSynthesis` speaks. There is no check for `aiState === 'speaking'` or `window.speechSynthesis.speaking`. The user's microphone picks up the synthesized speech from the laptop speakers and feeds it back as a user reply, endlessly re-triggering `generateAIResponse()`.

2. **Microservice Routing Prefix Mismatch in `client.ts`**:
   - `src/api/client.ts` (lines 51–57):
     ```typescript
     } else if (
       cleanEndpoint.startsWith('/resume-maker') ||
       cleanEndpoint.startsWith('/cover-letter') ||
       cleanEndpoint.startsWith('/code-execution') ||
       cleanEndpoint.startsWith('/upload')
     ) {
       baseUrl = import.meta.env.VITE_TOOLS_API_BASE_URL || ...;
     ```
   - `src/pages/dashboard/LiveInterview.tsx` (line 189):
     ```typescript
     const res = await apiFetch<CodeRunResult>('/code/execute', {
       method: 'POST',
       body: JSON.stringify({ language: selectedLang, code }),
     });
     ```
     Endpoint called is `/code/execute`. `client.ts` checks for `/code-execution`. Thus, `/code/execute` falls through to `VITE_CORE_API_BASE_URL` (port 8001) instead of `VITE_TOOLS_API_BASE_URL` (port 8003), generating 404 in microservices deployment.

3. **Orphaned `useFaceAnalyzer` Hook & Mock Telemetry**:
   - `src/hooks/useFaceAnalyzer.ts`:
     Implements `@vladmandic/face-api` loader, EAR (Eye Aspect Ratio) blink detector, and attention scoring.
     Grep across `src/` for `useFaceAnalyzer`: 0 imports across the entire project.
   - `src/pages/dashboard/LiveInterview.tsx` (lines 823–827):
     ```typescript
     await apiFetch('/interview/analyze', {
       method: 'POST',
       body: JSON.stringify({
         session_id: sessionId,
         telemetry: { avg_confidence: 0.88, blink_count: 14 },
       }),
     });
     ```
     Hardcoded values `{ avg_confidence: 0.88, blink_count: 14 }` are sent to the backend. The embedded `FacialAnalysisHUD` component performs local canvas processing but its metrics are not exposed or passed to `handleDisconnect`.

4. **Fragile `getUserMedia` Constraint Failure**:
   - `src/pages/dashboard/LiveInterview.tsx` (lines 733–738):
     ```typescript
     const stream = await navigator.mediaDevices.getUserMedia({
       video: true,
       audio: true,
     });
     ```
     If the user does not have a webcam or denies camera permissions, the call rejects immediately, preventing audio acquisition and aborting the interview completely.

5. **Toast Hidden Behind Live Interview Layout**:
   - `src/styles/interview.css` (line 11):
     ```css
     .interview-layout {
       ...
       z-index: 9999;
     }
     ```
   - `src/components/Toast.tsx` (line 46):
     ```tsx
     <div className="toast-container" style={{ ... zIndex: 999 }}>
     ```
     The Toast container has `z-index: 999`, while `.interview-layout` has `z-index: 9999`. All toasts during the interview are completely occluded.

6. **State Destruction on Language Switch**:
   - `src/pages/dashboard/LiveInterview.tsx` (lines 180–183):
     ```typescript
     const handleLanguageChange = (lang: string) => {
       setSelectedLang(lang);
       setCode(getBoilerplate(lang));
     };
     ```
     User-written code is instantly overwritten with template boilerplate on language selection change with no confirmation or per-language cache.

7. **Infinite Polling & Missing Error State in `InterviewReport.tsx`**:
   - `src/pages/dashboard/InterviewReport.tsx` (lines 47–67, 107):
     ```typescript
     const pollInterval = setInterval(async () => {
       const res = await apiFetch<InterviewReportData>(`/interview/report/${sessionId}`);
       if (res.ok && res.data) {
         setReport(res.data);
         clearInterval(pollInterval);
       }
     }, 3000);
     ```
     If the report generation fails or returns 500, `pollInterval` never clears, and the screen is trapped in "Your report is being generated" indefinitely.

---

### 1.4 General Codebase & Dashboard Issues

1. **Synchronous React Router Navigation During Render**:
   - `src/pages/OtpVerify.tsx` (lines 127–130):
     ```typescript
     if (!email) {
       navigate('/signup');
       return null;
     }
     ```
     `navigate()` is executed directly during render execution rather than inside a `useEffect()`.

2. **Invalid CSS String Concatenation**:
   - `src/components/AnnouncementBanner.tsx` (line 66):
     ```typescript
     border: '1px solid ' + textColor + '30',
     ```
     When `textColor` is `var(--primary)` or named color, string appending produces invalid CSS `var(--primary)30`, discarded by CSS parsers.

3. **CSS Class Mismatch in Admin Templates**:
   - `src/pages/dashboard/AdminResumeTemplates.tsx` (lines 107, 111, 117, 125):
     ```tsx
     <input className="input" ... />
     ```
     `components.css` defines `.input-field`. `.input` does not exist, causing inputs to render as unstyled native browser inputs.

4. **Missing `.spinner` CSS Animation Class in Admin Pages**:
   - `src/pages/dashboard/AdminPanel.tsx` (line 100), `AdminSettings.tsx` (line 124), `AdminUsers.tsx` (line 185):
     ```tsx
     <div className="spinner" />
     ```
     `utilities.css` and `components.css` define `.loading-spinner` and `.inline-spinner`, but `.spinner` is not defined anywhere, rendering an invisible 0x0 element.

5. **Blob URL Memory Leak in Resume Tailor**:
   - `src/pages/dashboard/ResumeTailor.tsx` (line 139):
     ```typescript
     const blob = await res.blob();
     setPdfUrl(URL.createObjectURL(blob));
     ```
     No call to `URL.revokeObjectURL(oldUrl)` when re-compiling or when component unmounts.

6. **Deprecated `document.execCommand`**:
   - `src/pages/dashboard/ResumeTailor.tsx` (lines 80–83):
     Uses `document.execCommand('bold')`, `document.execCommand('italic')`, etc., in the injected iframe toolbar.

7. **Instant Logout on 401 Without Token Refresh**:
   - `src/api/client.ts` (lines 122–124) & `src/context/AuthContext.tsx` (lines 86–90):
     On any 401, `_onUnauthorized?.()` immediately triggers `logout()`, clearing localStorage and logging the user out. There is no silent token refresh mechanism implemented.

8. **Inconsistent File Upload Form Field Keys**:
   - `Resumes.tsx` (line 58): `formData.append('file', file);`
   - `AtsChecker.tsx` (line 72): `formData.append('resume_file', file);`
   - `LinkedInOptimizer.tsx` (line 46): `formData.append('profile_file', file);`
   - Inconsistent field keys across services create contract drift with backend FastAPI `UploadFile = File(...)` parameters.

9. **Vite Proxy Disconnect from Corrupted `.env`**:
   - In `vite.config.ts`, only `/api` is proxied to `http://127.0.0.1:8000`.
   - In `client.ts`, if `.env` is corrupted (which it is), `fallback` evaluates to `'/api'`.
   - When calling endpoints like `apiFetch('/users/me')`, `baseUrl` evaluates to `'/api'`, and `fetch('/api/users/me')` is sent.
   - If the backend microservices run without an `/api` prefix on ports 8001/8002/8003, all requests fail with 404/502.

---

## 2. Logic Chain

1. **Toolchain & Style Execution**:
   - **Fact**: `CinematicHeroSection.tsx` relies entirely on Tailwind classes (`h-[360vh]`, `sticky top-0 h-screen`, `bg-[#050308]`, `selection:bg-[#7209B7]/30`) for layout, height runway, and positioning.
   - **Fact**: `package.json` contains no Tailwind dependencies, and `vite.config.ts` loads only `@vitejs/plugin-react`.
   - **Deduction**: In production and development builds, Vite does not compile Tailwind utility classes into CSS. Consequently, `h-[360vh]` has no rule, reducing container height to auto. `sticky top-0 h-screen` has no rule. The entire pinned cinematic scroll experience fails to operate, collapsing into an unstyled stack.

2. **Audio Feedback Loop in Live Interview**:
   - **Fact**: `recognition.start()` keeps the Web Speech API recognition engine actively recording microphone input.
   - **Fact**: `window.speechSynthesis.speak()` outputs the AI assistant's voice through the device's speakers.
   - **Fact**: `recognition.onresult` lacks any check for whether speech synthesis is active (`window.speechSynthesis.speaking` or `aiState === 'speaking'`).
   - **Deduction**: On laptops and desktop setups without headphones, the microphone picks up the speaker audio. The recognizer transcribes the AI's question, commits it to `messages` as a `user` message, and triggers `generateAIResponse()`. The AI then generates an answer to its own question and speaks again, creating an infinite, self-sustaining conversational loop.

3. **Microservices Code Execution Routing**:
   - **Fact**: In `client.ts`, endpoint routing logic specifies:
     `if (cleanEndpoint.startsWith('/code-execution')) return VITE_TOOLS_API_BASE_URL + endpoint;`
   - **Fact**: In `LiveInterview.tsx`, line 189 calls `apiFetch('/code/execute', ...)`.
   - **Fact**: `/code/execute` does not start with `/code-execution`.
   - **Deduction**: The request falls through the `if` branches into the fallback `VITE_CORE_API_BASE_URL` (Core Service on port 8001). The Core service has no `/code/execute` route; that route resides only in the Tools microservice (port 8003). Therefore, code execution in the Live Interview fails with a 404 in microservices environments.

4. **Reactbits WebGL Shader Thrash**:
   - **Fact**: `AnimatedBackground.tsx` passes `gradientColors={['#FF9FFC', '#5227FF']}` directly as an inline literal to `GradientBlinds`.
   - **Fact**: `GradientBlinds.tsx` has `useEffect` with `gradientColors` in its dependency array. Inside that effect, it tears down the existing canvas and creates a new OGL WebGL context.
   - **Deduction**: Whenever `Landing.tsx` updates state (e.g. scroll handlers updating active section, clicking demo tabs), `AnimatedBackground` re-renders, producing a new array reference. This triggers the cleanup and initialization of the WebGL context 30–60 times, causing GPU pipeline stalls, DOM thrashing, and "Too many active WebGL contexts" crashes.

5. **Toast Occlusion**:
   - **Fact**: `.interview-layout` has `z-index: 9999` in `interview.css`.
   - **Fact**: `.toast-container` has `zIndex: 999` in `Toast.tsx`.
   - **Deduction**: In DOM stacking order, any element with z-index 999 sits below an element with z-index 9999. Any error or success toasts triggered while the user is inside the Live Interview kiosk are rendered invisibly behind the interview container.

---

## 3. Caveats

1. **Static Inspection Scope**: This audit was conducted via exhaustive static code analysis, AST inspection, regex pattern matching, and configuration tracing. No interactive browser UI clicks or live audio hardware tests were executed during this phase.
2. **Backend Microservice Contracts**: Upload field name differences (`file` vs `resume_file` vs `profile_file`) and routing mismatches (`/code/execute` vs `/code-execution`) reflect differences in frontend code vs expected backend schemas; backend FastAPI endpoints should be cross-verified during integration testing.
3. **Model Weights Directory**: The `@vladmandic/face-api` model weights are typically hosted in `/public/models/`. Because that directory is currently missing, runtime loading of face-api models will fail until weight files are provisioned.

---

## 4. Conclusion

The SMART APPLY frontend possesses a modern UI architecture with Framer Motion, Monaco Editor, and React 19, but suffers from several critical architectural, visual, and operational defects that must be resolved prior to release.

### Comprehensive Bug Matrix

| ID | Location | Category | Severity | Summary | Recommended Fix |
|:---|:---|:---|:---|:---|:---|
| **FE-01** | `CinematicHeroSection.tsx:146-300`, `SmartApplyLogoReveal.tsx:86`, `package.json`, `index.css` | Styling / Build | **CRITICAL** | Tailwind utility classes used across hero and admin without Tailwind compiler/plugin configured. | Install `@tailwindcss/vite` and `tailwindcss` (or compile Tailwind utility classes into vanilla CSS). Add `@import "tailwindcss";` to `index.css`. |
| **FE-02** | `LiveInterview.tsx:690-713` | Logic / Audio | **CRITICAL** | Speech recognition records AI synthesized speech output, causing infinite echo conversational loop. | Add guard in `recognition.onresult`: `if (aiState === 'speaking' \|\| window.speechSynthesis.speaking) return;`. Stop recognition during AI speech and restart upon `utterance.onend`. |
| **FE-03** | `client.ts:51-57`, `LiveInterview.tsx:189` | Routing / API | **CRITICAL** | Microservice endpoint routing mismatch: `client.ts` expects `/code-execution`, but `LiveInterview` calls `/code/execute`. | Update `client.ts` to check `cleanEndpoint.startsWith('/code')` or change call to `/code-execution/execute`. |
| **FE-04** | `frontend/.env:1` | Config / Env | **HIGH** | `.env` file corrupted with 26 bytes of `?`. Environment variables fail to load. | Overwrite `.env` with valid key-value pairs matching `.env.example`. |
| **FE-05** | `Navbar.tsx:12`, `Landing.tsx` | Navigation | **HIGH** | Dead anchor: `#interview-studio` in Navbar does not correspond to any element ID in `Landing.tsx`. | Add `id="interview-studio"` to the interactive interview demo section in `Landing.tsx`. |
| **FE-06** | `Landing.tsx:658-660`, `interview.css` | Styling | **HIGH** | Waveform bars in Landing demo have no CSS styling (`.waveform-container`, `.waveform-bar` missing). | Add `.waveform-container` and `.waveform-bar` styles in `components.css`. |
| **FE-07** | `useFaceAnalyzer.ts:1-120`, `LiveInterview.tsx:826`, `public/models` | Dead Code / Mock | **HIGH** | `useFaceAnalyzer` is completely orphaned; live interview submits hardcoded mock telemetry; models missing from `public/`. | Wire up face analysis telemetry to interview submission or bundle face-api model weights in `public/models/`. |
| **FE-08** | `LiveInterview.tsx:733-738` | Hardware / UX | **HIGH** | `getUserMedia({ video: true, audio: true })` rejects completely if webcam is missing, blocking audio-only interviews. | Catch video acquisition failure and gracefully fall back to `{ audio: true }`. |
| **FE-09** | `OtpVerify.tsx:127-130` | Reactivity | **HIGH** | Synchronous `navigate('/signup')` during component render violates React pure rendering rules. | Move navigation call into `useEffect(() => { if (!email) navigate('/signup'); }, [email, navigate]);`. |
| **FE-10** | `Toast.tsx:46`, `interview.css:11` | Stacking / UI | **MEDIUM** | Toast container `z-index: 999` is hidden behind `interview-layout` `z-index: 9999`. | Increase `.toast-container` z-index to `100000` in `Toast.tsx` / `components.css`. |
| **FE-11** | `AnimatedBackground.tsx:25`, `GradientBlinds.tsx:371` | Performance / WebGL | **MEDIUM** | Unmemoized `gradientColors` array forces WebGL context destruction and re-instantiation on every render. | Memoize array in `AnimatedBackground.tsx` with `useMemo(() => ['#FF9FFC', '#5227FF'], [])`. |
| **FE-12** | `StarBorder.tsx:46`, `AuroraBackground.tsx:152-198` | CSS / Animation | **MEDIUM** | Missing `@keyframes starBorderSpin`, `auroraFloat1/2/3`, `auroraPulse` across all stylesheets. | Define required `@keyframes` in `reactbits.css`. |
| **FE-13** | `AuroraBackground.tsx:118` | A11y / UI | **MEDIUM** | `pointerEvents: 'none'` on element with `onMouseMove` prevents mouse spotlight tracking. | Change wrapper `pointerEvents` to `'auto'` or move listener to window/parent container. |
| **FE-14** | `reactbits.css:47`, `tokens.css` | Styling | **MEDIUM** | Undefined `--accent-rgb` causes invalid CSS `rgba(, 0.18)` for SpotlightCard. | Define `--accent-rgb: 124, 58, 237;` in `tokens.css`. |
| **FE-15** | `SquaresBackground.tsx:77-78` | Performance | **MEDIUM** | Synchronous `getComputedStyle` in 60Hz `requestAnimationFrame` loop causes layout thrashing. | Cache computed theme color outside the `draw()` animation loop and refresh only on theme change. |
| **FE-16** | `LiveInterview.tsx:180-183` | Data Loss / UX | **MEDIUM** | Language dropdown change immediately replaces editor code with boilerplate without user warning. | Store code in a per-language dictionary map or show a confirmation prompt before overwriting. |
| **FE-17** | `InterviewReport.tsx:47-67, 107` | Logic / Network | **MEDIUM** | Report polling loop never halts on 404/500 errors; user stuck in infinite loading state. | Add maximum retry count (e.g. 10 attempts), clear interval on persistent failure, and render error banner. |
| **FE-18** | `AnnouncementBanner.tsx:66` | Styling / Syntax | **MEDIUM** | `border: '1px solid ' + textColor + '30'` creates invalid CSS for CSS variables. | Use CSS opacity or `color-mix()` instead of hex-alpha string concatenation. |
| **FE-19** | `AdminResumeTemplates.tsx:107-125` | Styling | **MEDIUM** | Uses `className="input"` instead of `className="input-field"`, rendering unstyled native controls. | Update `className="input"` to `className="input-field"` across all template forms. |
| **FE-20** | `AdminPanel.tsx:100`, `AdminSettings.tsx:124`, `AdminUsers.tsx:185` | Styling | **MEDIUM** | Uses `<div className="spinner" />`, but `.spinner` is not defined anywhere in CSS. | Update `className="spinner"` to `className="loading-spinner"`. |
| **FE-21** | `ResumeTailor.tsx:139` | Memory Leak | **MEDIUM** | `URL.createObjectURL(blob)` called on every LaTeX compile without revoking previous blob URLs. | Store previous URL in a ref and invoke `URL.revokeObjectURL(prevUrl)` on each update and on unmount. |
| **FE-22** | `ResumeTailor.tsx:80-83` | Web Standards | **MEDIUM** | Deprecated `document.execCommand` used in WYSIWYG floating toolbar. | Modernize formatting logic or wrap with safety fallback checks. |
| **FE-23** | `src/{api,context,hooks,components,pages` | Hygiene / Filesystem | **MEDIUM** | Malformed shell expansion left empty folder structure inside `src/`. | Delete orphaned folder `src/{api,context,hooks,components,pages/`. |
| **FE-24** | `public/*.png`, `public/*.svg` | Asset Optimization | **MEDIUM** | 4.07 MB of duplicate logo/favicon PNG and SVG files. | Deduplicate icons and compress raster images into optimized assets. |
| **FE-25** | `package.json:6-10` | DevOps / QA | **LOW** | Missing `"test": "vitest run"` and `"lint"` scripts in `package.json`. | Add test and lint script targets in `package.json`. |
| **FE-26** | `Landing.tsx:811` | Interaction | **LOW** | "Copy Prompt" badge is a dead `<span>` without click handler. | Add `onClick` handler that copies prompt text to clipboard via `navigator.clipboard.writeText`. |
| **FE-27** | `client.ts:122-124`, `AuthContext.tsx:86-90` | Auth / UX | **MEDIUM** | Immediate logout on any 401 without silent refresh-token exchange. | Implement token refresh handler via `/auth/refresh-token` before clearing session. |
| **FE-28** | `Resumes.tsx:58`, `AtsChecker.tsx:72`, `LinkedInOptimizer.tsx:46` | API Contract | **MEDIUM** | Inconsistent multipart upload keys (`file`, `resume_file`, `profile_file`). | Standardize multipart form field keys to match backend FastAPI route expectations. |

---

## 5. Verification Method

To independently verify all findings and confirm remediation:

### 5.1 Static Verification Commands

1. **Verify Tailwind Classes in Source vs Config**:
   ```powershell
   # Search for arbitrary Tailwind brackets
   rg "h-\[" d:\SMARTAPPLY\frontend\src\
   # Verify lack of tailwind in dependencies
   rg "tailwind" d:\SMARTAPPLY\frontend\package.json
   ```
   *Expected*: Multiple arbitrary classes present in components, but zero occurrences in `package.json`.

2. **Verify Dead Anchor in Navbar**:
   ```powershell
   rg "interview-studio" d:\SMARTAPPLY\frontend\src\
   ```
   *Expected*: Found ONLY in `Navbar.tsx:12`, 0 occurrences in `Landing.tsx`.

3. **Verify Waveform Class Absence**:
   ```powershell
   rg "waveform-container|waveform-bar" d:\SMARTAPPLY\frontend\src\styles\
   ```
   *Expected*: 0 matches across all CSS stylesheets.

4. **Verify Missing CSS Animations**:
   ```powershell
   rg "@keyframes (starBorderSpin|auroraFloat|auroraPulse)" d:\SMARTAPPLY\frontend\src\styles\
   ```
   *Expected*: 0 matches.

5. **Verify Routing Prefix Discrepancy**:
   ```powershell
   rg "/code/execute" d:\SMARTAPPLY\frontend\src\
   rg "code-execution" d:\SMARTAPPLY\frontend\src\api\client.ts
   ```
   *Expected*: `LiveInterview.tsx` calls `/code/execute` while `client.ts` branches on `/code-execution`.

6. **Verify Audio Loop Gap in Live Interview**:
   Inspect `LiveInterview.tsx` lines 690–713 to confirm `recognition.onresult` has no check for `aiState === 'speaking'` or `window.speechSynthesis.speaking`.

7. **Verify Orphaned Shell Directory**:
   ```powershell
   Test-Path "d:\SMARTAPPLY\frontend\src\{api,context,hooks,components,pages"
   ```
   *Expected*: Returns `True`.

### 5.2 Build & Test Verification

Once remediation is executed:
1. `npm run build` in `frontend/` must complete without TypeScript or bundling errors.
2. `npx vitest run` must execute all unit and integration tests cleanly.
3. In browser devtools, loading `http://localhost:5173/` must produce 0 WebGL shader context lost warnings, valid sticky scroll hero pinning, and visible audio waveform bars.
