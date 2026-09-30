# Frontend Architecture & Survey Handoff Report

**Agent**: `explorer_frontend_survey_1`  
**Working Directory**: `d:\SMARTAPPLY\.agents\teamwork\explorer_frontend_survey_1\`  
**Target Focus**: Comprehensive Frontend Codebase Survey (Special Focus on Landing Page & Live Interview Page)  
**Date**: 2026-09-30  

---

## 1. Observation

### 1.1 Root Configuration & Environment
- **`package.json`** (`d:\SMARTAPPLY\frontend\package.json`):
  - Framework & Core: React 19 (`react: ^19.2.7`, `react-dom: ^19.2.7`), React Router 7 (`react-router-dom: ^7.18.0`).
  - Graphics & UI Libs: `framer-motion: ^12.42.0`, `lucide-react: ^1.21.0`, `ogl: ^1.0.11` (WebGL engine for shaders), `@monaco-editor/react: ^4.7.0`, `recharts: ^3.9.2`, `react-markdown: ^10.1.0`, `react-easy-crop: ^6.0.2`.
  - Machine Learning: `@vladmandic/face-api: ^1.7.15`.
  - Build & Dev: `vite: ^8.1.0`, `@vitejs/plugin-react: ^6.0.3`, `typescript: ~6.0.2`.
  - Testing: `vitest: ^4.1.10`, `jsdom: ^29.1.1`, `@testing-library/react: ^16.3.2`, `@testing-library/jest-dom: ^6.9.1`.
  - Scripts:
    ```json
    "scripts": {
      "dev": "vite",
      "build": "tsc && vite build",
      "preview": "vite preview"
    }
    ```
    *No `"test"` script or `"lint"` script is defined.*
  - **Notable omission**: `tailwindcss` and `@tailwindcss/vite` are **completely absent** from `dependencies` and `devDependencies`.
- **`vite.config.ts`** (`d:\SMARTAPPLY\frontend\vite.config.ts`):
  - Port `5173`.
  - Reverse proxy: `/api` -> `http://127.0.0.1:8000` with `changeOrigin: true` and `ws: true`.
  - Test config: `environment: 'jsdom'`, `globals: true`, `setupFiles: './src/test-setup.ts'`.
- **`tsconfig.json`** (`d:\SMARTAPPLY\frontend\tsconfig.json`):
  - `target: "es2023"`, `moduleResolution: "bundler"`, `allowImportingTsExtensions: true`, `verbatimModuleSyntax: true`, `noEmit: true`, `strict: true`.
- **`.env` and `.env.example`** (`d:\SMARTAPPLY\frontend\.env`):
  - `.env` contains literal corrupt text: `??????????????????????????` (26 bytes).
  - `.env.example` defines `VITE_API_BASE_URL=/api`.

### 1.2 Complete File & Component Inventory

#### 1.2.1 Core & Setup Files
- `src/main.tsx`: Root bootstrap wrapping tree with `<StrictMode>`, `<MotionConfig reducedMotion="user">`, `<ThemeProvider>`, `<BrowserRouter>`, `<AuthProvider>`, `<ToastProvider>`, `<ErrorBoundary>`, `<App />`.
- `src/App.tsx`: App root with maintenance check (`/auth/public-settings`), route definition with React `Suspense` and `lazy` code-splitting, layout wrappers (`DashboardLayout`, `AdminLayout`, `ProtectedRoute`).
- `src/test-setup.ts`: Imports `@testing-library/jest-dom`.
- `src/vite-env.d.ts`: Vite client type declarations.
- `src/{api,context,hooks,components,pages/dashboard,styles}`: Empty orphaned folder created by unexpanded shell command.

#### 1.2.2 State Management & Contexts
- **`src/context/AuthContext.tsx`**:
  - Manages `user: User | null`, `token: string | null`, `sessionId: string`, `isAuthenticated: boolean`, `lastAuthEvent: AuthSocketEvent | null`.
  - Syncs with `localStorage` (`sa_user`, `sa_token`).
  - Calls `configureClient` synchronously in render for first-paint token attachment.
- **`src/context/ThemeContext.tsx`**:
  - Manages `theme: 'light' | 'dark'`.
  - Syncs with `localStorage` (`sa_theme`) and sets `document.documentElement.setAttribute('data-theme', theme)`.
- **`src/components/Toast.tsx` (`ToastProvider`)**:
  - Global reactive toast stack managing success/error/info notifications with auto-dismiss timers and spring exit animations.

#### 1.2.3 Custom Hooks
- **`src/hooks/useAuthSocket.ts`**:
  - Connects to `/api/ws/auth/{sessionId}` via WebSocket.
  - Generates/stores `sessionStorage('sa_session_id')`.
  - Exponential backoff reconnection (1s up to 30s).
- **`src/hooks/useFaceAnalyzer.ts`**:
  - Loads models from `/models` (`tinyFaceDetector`, `faceLandmark68Net`, `faceExpressionNet`).
  - Computes Eye Aspect Ratio (EAR) for blink detection and facial expression confidence.
  - *Observation*: **Unused across the entire application**. `LiveInterview.tsx` does not import it.

#### 1.2.4 API Client (`src/api/client.ts` & `src/api/types.ts`)
- Configurable base URLs via endpoint prefix sniffing:
  - `/ai`, `/interview`, `/tailor`, `/jobs` -> `VITE_AI_API_BASE_URL`
  - `/resume-maker`, `/cover-letter`, `/code-execution`, `/upload` -> `VITE_TOOLS_API_BASE_URL`
  - Other endpoints -> `VITE_CORE_API_BASE_URL`
- Automatic retry on network failure (500ms delay, 1 retry).
- Types: `User`, `Resume`, `ResumeTemplate`, `DashboardStats`, `AtsCheckResult`, `ResumeParseResult`, `ChatMessage`, `Project`, `RoadmapPhase`, `InterviewReportData`, `ApiError`.

#### 1.2.5 Stylesheets (`src/styles/`)
1. `index.css`: Imports `tokens.css`, `base.css`, `components.css`, `utilities.css`, `reactbits.css`, plus `.skip-link` accessibility rule.
2. `tokens.css`: Color variables (`--paper`, `--surface`, `--ink`, `--accent`, `--success`, `--warning`, `--danger`), shadows, transitions, layout sizes.
3. `base.css`: Reset, smooth scrolling, font smoothing, focus rings, base typography.
4. `components.css`: Buttons (`.btn`, `.btn-primary`), input fields, cards, badges, chips, loaders, plus an ad-hoc set of ~25 Tailwind-like utility classes (`.flex`, `.gap-2`, `.mb-4`, etc.).
5. `utilities.css`: Containers (`.container`, `.container-narrow`), helper classes (`.text-muted`, `.font-mono`, etc.).
6. `dashboard.css`: Sidebar, dashboard shell, navigation links, header profile tile.
7. `interview.css`: 1,461 lines of custom styling for the live interview suite, HUD, Monaco editor container, speech waveforms, video tiles, transcript drawer.
8. `auth.css`: Auth cards, OTP input boxes, social buttons.
9. `docs.css`: Documentation layout, table of contents, markdown styles.
10. `legal.css`: Legal document layout.
11. `reactbits.css`: Animations, spotlight cards, gradient text.

#### 1.2.6 Components Inventory
- **Global & Layout**:
  - `src/components/Navbar.tsx`: Floating glass header with navigation anchors, theme switcher, auth CTA buttons.
  - `src/components/Sidebar.tsx`: Dashboard sidebar navigation with user avatar, logout button, and theme switcher.
  - `src/components/DashboardLayout.tsx`: Responsive shell wrapping sidebar and main content area.
  - `src/components/AdminLayout.tsx`: Layout shell for sysadmin pages.
  - `src/components/AdminSidebar.tsx`: Sidebar for admin panel.
  - `src/components/AdminSpotlight.tsx`: Quick command palette (`Cmd+K`) for admin tools.
  - `src/components/ProtectedRoute.tsx`: Route guard checking `isAuthenticated` and redirecting to `/login`.
  - `src/components/ErrorBoundary.tsx`: Class error boundary with catch handler and reload UI.
  - `src/components/AnnouncementBanner.tsx`: System announcement banner fetching from `/auth/public-settings`.
  - `src/components/CookieConsent.tsx`: GDPR cookie consent dialog.
  - `src/components/LoadingSpinner.tsx`: Loading spinners, skeleton cards, inline loaders, page loaders.
  - `src/components/ImageCropModal.tsx`: Image cropping modal using `react-easy-crop` for profile photos.
  - `src/components/ThemeSwitcher.tsx` & `ThemeToggleFloating.tsx`: Dark/light mode switcher widgets.
  - `src/components/Icons.tsx`: Custom SVG icons (Google, LinkedIn, etc.).
  - `src/components/EmptyState.tsx`: Reusable empty state view.
  - `src/components/PageHeader.tsx`: Title and action header for dashboard views.
  - `src/components/AnimatedBackground.tsx`: Fixed background wrapper rendering `GradientBlinds`.
- **Cinematic Hero (`src/components/cinematic-hero/`)**:
  - `CinematicHeroSection.tsx`: 380vh scroll runway with Parallax, split typography, logo reveal, auto-play mode.
  - `CinematicParticleCanvas.tsx`: HTML5 canvas rendering violet/magenta drifting constellation particles.
  - `FloatingVioletOrbs.tsx`: Framer-motion floating atmospheric gradient orbs with mouse parallax.
  - `SmartApplyLogoReveal.tsx`: Central SVG/PNG logo zoom, rotation, and wordmark reveal.
  - `index.ts`: Re-export barrel.
- **Reactbits UI Primitives (`src/components/reactbits/`)**:
  - `AuroraBackground.tsx`: Animated SVG aurora gradient.
  - `BlurText.tsx`: Staggered character blur-in text animation.
  - `CountUp.tsx`: Numeric counter animation using Framer Motion.
  - `DecryptedText.tsx`: Matrix-style cipher scramble text reveal.
  - `FullPageBackground.tsx`: Fullscreen canvas ambient gradient.
  - `GradientBlinds.tsx` & `GradientBlinds.css`: WebGL shader on canvas via `ogl` rendering interactive animated blinds.
  - `ShinyText.tsx`: Shimmering text gradient effect.
  - `SplitText.tsx`: Word/letter split animation.
  - `SpotlightCard.tsx`: Radial mouse spotlight card container.
  - `SquaresBackground.tsx`: Interactive grid squares background.
  - `StarBorder.tsx`: Animated border gradient highlight.
  - `TiltedCard.tsx`: 3D perspective tilt on hover with glare effect.

#### 1.2.7 Pages Inventory & Routing Map
| Route Path | Page Component | Access | Layout Wrapper |
|---|---|---|---|
| `/` | `Landing.tsx` | Public | None (Autonomous) |
| `/hero-preview` | `HeroPreview.tsx` | Public | None (Autonomous) |
| `/docs` | `Docs.tsx` | Public | Navbar / Minimal |
| `/login` | `Login.tsx` | Public (Guest) | Auth Page Shell |
| `/signup` | `Signup.tsx` | Public (Guest) | Auth Page Shell |
| `/verify-otp` | `OtpVerify.tsx` | Public | Auth Page Shell |
| `/reset-password` | `ResetPassword.tsx` | Public | Auth Page Shell |
| `/privacy-policy` | `PrivacyPolicy.tsx` | Public | Legal Shell |
| `/terms` | `TermsConditions.tsx` | Public | Legal Shell |
| `/cookies-policy` | `CookiesPolicy.tsx` | Public | Legal Shell |
| `/onboarding` | `Onboarding.tsx` | Protected | Standalone |
| `/dashboard` | `Home.tsx` | Protected | `DashboardLayout` |
| `/dashboard/resumes` | `Resumes.tsx` | Protected | `DashboardLayout` |
| `/dashboard/cover-letter` | `CoverLetterGenerator.tsx` | Protected | `DashboardLayout` |
| `/dashboard/jobs` | `JobMatching.tsx` | Protected | `DashboardLayout` |
| `/dashboard/tailor-resume/:id` | `ResumeTailor.tsx` | Protected | `DashboardLayout` |
| `/dashboard/ats-checker` | `AtsChecker.tsx` | Protected | `DashboardLayout` |
| `/dashboard/ai-chatbot` | `AiChatbot.tsx` | Protected | `DashboardLayout` |
| `/dashboard/project-recommender` | `ProjectRecommender.tsx` | Protected | `DashboardLayout` |
| `/dashboard/idea-prompt-generator` | `IdeaPromptGenerator.tsx` | Protected | `DashboardLayout` |
| `/dashboard/live-interview` | `LiveInterview.tsx` | Protected | **Standalone Portal** (No `DashboardLayout`) |
| `/dashboard/live-interview/report/:roomName` | `InterviewReport.tsx` | Protected | `DashboardLayout` |
| `/dashboard/interview-report/:roomName` | `InterviewReport.tsx` | Protected | `DashboardLayout` |
| `/dashboard/profile` | `Profile.tsx` | Protected | `DashboardLayout` |
| `/dashboard/settings` | `Settings.tsx` | Protected | `DashboardLayout` |
| `/dashboard/linkedin` | `LinkedInOptimizer.tsx` | Protected | `DashboardLayout` |
| `/dashboard/resume-maker` | `ResumeMaker.tsx` | Protected | `DashboardLayout` |
| `/dashboard/sysadmin` | `AdminPanel.tsx` | Protected (Admin) | `AdminLayout` |
| `/dashboard/sysadmin/users` | `AdminUsers.tsx` | Protected (Admin) | `AdminLayout` |
| `/dashboard/sysadmin/settings` | `AdminSettings.tsx` | Protected (Admin) | `AdminLayout` |
| `/dashboard/sysadmin/resume-templates` | `AdminResumeTemplates.tsx` | Protected (Admin) | `AdminLayout` |
| `*` | `NotFound.tsx` | Public | Fallback |

---

## 2. Logic Chain

### 2.1 Landing Page Architecture
1. **Viewport & Scroll Runway**:
   - `Landing.tsx` begins with `<CinematicHeroSection onExploreClick={handleExploreClick} />`, occupying a sticky container over a 380vh scroll runway (`h-[360vh] sm:h-[380vh]`).
   - Parallax scrolling binds scroll position via `useScroll` and `useSpring` to:
     - Split typography (`"SMART"` translates left by -180px, `"APPLY"` translates right by +180px).
     - Scale and reveal the central `SmartApplyLogoReveal` (0.68 -> 1.0 scale, -3.5° -> 0° rotation).
     - Fade in wordmark and tagline ("AI-POWERED JOB APPLICATIONS").
     - An auto-play cinematic preview animates window scroll over 7.5 seconds using `requestAnimationFrame`.
2. **Dynamic Navbar Synchronization**:
   - `Landing.tsx` maintains state `inHeroTrack: boolean`. An `onScroll` listener tracks `window.scrollY < window.innerHeight * 2.5`.
   - `<Navbar visible={!inHeroTrack} />` only animates down after the user scrolls past the cinematic sequence.
3. **Interactive HUD Sandbox Showcase**:
   - Wrapped inside `<TiltedCard maxTilt={4}>`, the interactive sandbox provides:
     - Role specification switchers (`SAMPLE_ROLES`: backend, frontend, devops).
     - Tab navigation between 4 live modules: Resume Tailor & ATS score, Voice Mock Interview audio waveform, LaTeX & PDF source preview, and Project Recommender build prompt.
4. **Feature Grid & Value Propositions**:
   - 6 cards wrapped in `<SpotlightCard>` with mouse-following radial highlights.
   - 3-step workflow demonstration.
   - Architecture & security overview block.
   - Accordion FAQ with Framer Motion height animations.
   - Conversion footer banner and brand footer.
5. **Background Graphics Layer**:
   - `<AnimatedBackground />` renders `<GradientBlinds />` with WebGL (`ogl`), drawing real-time animated shader stripes with mouse distortion and light/dark theme adaptation.

### 2.2 Live Interview Page Architecture
1. **Layout Isolation**:
   - In `App.tsx`, `/dashboard/live-interview` is mounted as a direct child of `<ProtectedRoute>`, explicitly omitting `<DashboardLayout>`.
   - In `interview.css`, `.interview-layout` has `position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 9999;`. It acts as a full-screen kiosk.
2. **Pre-Call Stage (`status === 'idle'`)**:
   - Candidate microphone check: `useMicTester` initializes an offscreen `AudioContext`, attaches an `AnalyserNode` to local `getUserMedia({ audio: true })`, and animates a volume meter.
   - Specialization track selector: 5 tracks (HR, Technical, Behavioral, Executive, Creative).
3. **Connected Call Stage (`status === 'connected'`)**:
   - Hardware Media Streams: Acquires video + audio via `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`. Local stream is attached to `videoRef` with mirrored CSS (`transform: scaleX(-1)`).
   - Audio Speech-to-Text: Browser `SpeechRecognition` / `webkitSpeechRecognition` runs continuously (`continuous = true`, `interimResults = true`). Live transcript is mirrored to closed-caption HUD.
   - AI Response Generation: On final speech input, invokes `POST /interview/respond` with conversation history, theme, and candidate details.
   - Text-to-Speech Output: Uses browser `window.speechSynthesis`. Filters available voices for neural/natural English voices, cleans Markdown formatting (`*`, `#`, `` ` ``), and sets `aiState = 'speaking'`.
   - Live Vision HUD (`FacialAnalysisHUD`): Offscreen canvas (160x120) samples webcam frames every 1200ms using RGB skin-color clustering and eye-region luminance differentials to detect blinks, gaze direction, posture, and confidence.
   - Embedded Coding IDE: Monaco Editor (`@monaco-editor/react`) with syntax highlighting for Python, JS, TS, Java, C++, and live execution via `POST /code/execute`.
   - Live Transcript Drawer: Collapsible side panel storing role-delineated conversation history with time stamps.
4. **Session Teardown & Reporting**:
   - On disconnect, stops all audio/video tracks, cancels `SpeechSynthesis`, and sends `POST /interview/analyze` with transcript and telemetry summary.
   - Caches transcript in `localStorage.setItem('sa_transcript_${roomName}')` and routes to `/dashboard/live-interview/report/:roomName`.

---

## 3. Caveats
- Static investigation only; terminal execution of `npx tsc` timed out awaiting user interactive permission. Observations are based on direct source code inspection and cross-file pattern tracing.
- Backend code execution was investigated from route files (`backend/app/routers/code_execution.py` and `backend/app/routers/interview.py`) to verify frontend endpoint contracts.

---

## 4. Conclusion & Identified Hotspots

### High Severity Bug Hotspots
1. **Missing Tailwind CSS Dependency vs. Ubiquitous Tailwind Classes**:
   - **Files**: `src/components/cinematic-hero/CinematicHeroSection.tsx`, `SmartApplyLogoReveal.tsx`, `HeroPreview.tsx`, `AdminSettings.tsx`, `InterviewReport.tsx`.
   - **Details**: Components make heavy use of Tailwind classes (`h-[360vh]`, `sticky top-0 h-screen`, `bg-[#050308]`, `text-[#F7F2FF]`, `pointer-events-none`, `select-none`, `bg-gradient-to-r`, `from-[#7621B0]`, `animate-bounce`, `backdrop-blur-md`, `tracking-[0.2em]`, `flex-col`, `gap-4`). Neither `tailwindcss` nor `@tailwindcss/vite` is installed in `package.json`, and no Tailwind stylesheet is imported in `index.html` or `index.css`.
   - **Impact**: The Cinematic Hero runway, logo reveal, hero preview, and parts of the admin console are completely missing their layout, dimensions, colors, and positioning.
2. **Infinite Audio Echo Feedback Loop in Live Interview**:
   - **File**: `src/pages/dashboard/LiveInterview.tsx` (lines 680–725).
   - **Details**: `SpeechRecognition` remains active while the AI speaks through device speakers via `speechSynthesis`. In `recognition.onresult`, there is no guard checking `if (aiState === 'speaking') return;`. The microphone captures the AI's synthesized voice, transcribes it as candidate speech, and immediately fires `generateAIResponse()`, causing the AI to talk to itself indefinitely.
3. **Orphaned `useFaceAnalyzer` & Hardcoded Telemetry in Live Interview**:
   - **Files**: `src/hooks/useFaceAnalyzer.ts` vs. `src/pages/dashboard/LiveInterview.tsx` (line 826).
   - **Details**: `useFaceAnalyzer.ts` was implemented to load `@vladmandic/face-api` models and compute genuine face expressions and blink counts. However, `LiveInterview.tsx` never imports it. Instead, line 826 sends hardcoded mock values to the backend: `telemetry: { avg_confidence: 0.88, blink_count: 14 }`.
4. **Dead `#interview-studio` Anchor in Landing Navigation**:
   - **Files**: `src/components/Navbar.tsx` (line 12) vs. `src/pages/Landing.tsx`.
   - **Details**: `Navbar.tsx` defines `{ href: '#interview-studio', label: 'Voice Studio' }`, but `Landing.tsx` has no element with `id="interview-studio"`. Clicking the link fails to scroll or navigate.
5. **Microservice URL Routing Mismatch for Code Execution in `client.ts`**:
   - **Files**: `src/api/client.ts` (lines 54–57) vs. `src/pages/dashboard/LiveInterview.tsx` (line 189) vs. `backend/app/routers/code_execution.py` (line 32).
   - **Details**: `client.ts` checks `cleanEndpoint.startsWith('/code-execution')` to direct traffic to `VITE_TOOLS_API_BASE_URL`. However, `LiveInterview.tsx` calls `/code/execute` (and the backend router prefix is `/api/code`). Because `/code/execute` does not start with `/code-execution`, it defaults to `VITE_CORE_API_BASE_URL`, causing a 404 in microservice deployments.
6. **Undefined CSS Color Variables and Invalid Color Concatenation in `AnnouncementBanner`**:
   - **File**: `src/components/AnnouncementBanner.tsx` (lines 25–41, 66).
   - **Details**: `AnnouncementBanner` uses `var(--primary)`, `var(--primary-faint)`, `var(--success-faint)`, `var(--warning-faint)`, `var(--danger-faint)`. None of these exist in `tokens.css`. In addition, line 66 evaluates `border: '1px solid ' + textColor + '30'`, producing invalid CSS `border: 1px solid var(--primary)30`.

### Medium / Minor Observations
7. **Corrupted `.env` File**:
   - `frontend/.env` contains raw question marks (`??????????????????????????`).
8. **Orphaned Shell Expansion Directory**:
   - `src/{api,context,hooks,components,pages/dashboard,styles}` is an empty abandoned artifact from an unexpanded shell command.
9. **Unoptimized Favicon & Brand Asset Size**:
   - `public/favicon.png` is 611 KB and `public/favicon.svg` is 815 KB. Serving an 815 KB favicon on every public page load degrades performance and LCP/FCP.
10. **Synchronous `navigate()` During Render in `OtpVerify.tsx`**:
    - Lines 127–130 call `navigate('/signup')` directly in the component body when `email` is absent, violating React render phase rules.
11. **Missing Scripts and Incomplete Test Suite**:
    - `package.json` contains no `"test"` or `"lint"` scripts, and only a single test file exists (`AuthContext.test.tsx`).

---

## 5. Verification Method

To independently verify all findings:
1. **Verify Missing Tailwind Classes**:
   - Inspect `d:\SMARTAPPLY\frontend\package.json` lines 11–35: confirm absence of `tailwindcss`.
   - Inspect `d:\SMARTAPPLY\frontend\src\components\cinematic-hero\CinematicHeroSection.tsx` lines 146–149: observe Tailwind classes `h-[360vh]`, `bg-[#050308]`, `text-[#F7F2FF]`.
2. **Verify Live Interview Speech Recognition Loop**:
   - Inspect `d:\SMARTAPPLY\frontend\src\pages\dashboard\LiveInterview.tsx` lines 690–713: observe `recognition.onresult` handling `finalSpeech` with no check on `aiState`.
3. **Verify Orphaned `useFaceAnalyzer` & Hardcoded Telemetry**:
   - Search the codebase for `useFaceAnalyzer`: observe it is only referenced in its declaration (`src/hooks/useFaceAnalyzer.ts`).
   - Inspect `d:\SMARTAPPLY\frontend\src\pages\dashboard\LiveInterview.tsx` line 826: observe `{ avg_confidence: 0.88, blink_count: 14 }`.
4. **Verify Dead Anchor**:
   - Inspect `d:\SMARTAPPLY\frontend\src\components\Navbar.tsx` line 12: `#interview-studio`.
   - Search `d:\SMARTAPPLY\frontend\src\pages\Landing.tsx` for `interview-studio`: 0 matches.
5. **Verify Endpoint Routing Mismatch**:
   - Inspect `d:\SMARTAPPLY\frontend\src\api\client.ts` line 54: `cleanEndpoint.startsWith('/code-execution')`.
   - Inspect `d:\SMARTAPPLY\frontend\src\pages\dashboard\LiveInterview.tsx` line 189: `apiFetch('/code/execute')`.
6. **Verify Announcement Banner CSS**:
   - Inspect `d:\SMARTAPPLY\frontend\src\components\AnnouncementBanner.tsx` line 25 and 66.
   - Inspect `d:\SMARTAPPLY\frontend\src\styles\tokens.css` for `--primary`: 0 matches.
