# Dynamic UI Testing Audit Report — SMART APPLY

**Agent ID**: `worker_dynamic_ui_1`  
**Milestone**: M2 (Dynamic UI Testing)  
**Target System**: SMART APPLY (Frontend: React 19, TypeScript, Vite, Framer Motion, Monaco Editor; Backend: FastAPI, Motor/Beanie, Redis)  
**Date**: 2026-09-30T13:35:00Z  

---

## 1. Observation

Direct code inspections, DOM evaluations, CSSOM cascades, runtime hook lifecycles, and network routing configurations across `d:\SMARTAPPLY\frontend\` and `d:\SMARTAPPLY\backend\` reveal 30 distinct UI defects and architectural discrepancies.

### 1.1 Landing Page Observations
1. **Uncompiled Tailwind Classes in CSSOM**:
   In `frontend/src/components/cinematic-hero/CinematicHeroSection.tsx`:
   - Line 146: `<section ref={sectionRef} id="cinematic-hero" className="relative w-full h-[360vh] sm:h-[380vh] md:h-[400vh] bg-[#050308] text-[#F7F2FF] select-none">`
   - Line 149: `<div className="sticky top-0 h-screen w-full flex flex-col justify-between overflow-hidden bg-[#050308]">`
   - Line 152: `<div className="absolute inset-0 z-0 pointer-events-none bg-[#050308]" />`
   - Line 155: `<motion.div className="absolute inset-0 z-[1] pointer-events-none" style={{ opacity: bgVioletGlowOpacity }}>`
   - Line 170: `<div className="absolute inset-0 z-[2] pointer-events-none">`
   - Line 179: `<motion.div className="absolute inset-0 z-[6] pointer-events-none">`
   - Line 239: `className="absolute inset-0 flex items-center justify-center pointer-events-none px-4 sm:px-8"`
   - Line 300: `className="px-6 py-3 rounded-full font-semibold text-xs sm:text-sm tracking-wide text-white bg-gradient-to-r from-[#7621B0] via-[#9B00FF] to-[#E000D6] hover:brightness-110 shadow-[0_0_30px_rgba(155,0,255,0.4)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"`
   - Line 303: `<ChevronDown className="w-4 h-4 animate-bounce" />`
   - Line 321: `className="w-[1px] h-9 sm:h-12 bg-gradient-to-b from-transparent via-[#9B00FF] to-transparent"`
   In `frontend/package.json`, Tailwind is NOT installed in `devDependencies` or `dependencies`. In `frontend/src/styles/index.css`, only custom CSS files (`tokens.css`, `base.css`, `components.css`, `utilities.css`, `reactbits.css`) are loaded. A ripgrep search for `.relative`, `h-[360vh]`, `.sticky`, `.absolute`, `.inset-0`, `.h-screen`, `bg-[#050308]`, `animate-bounce`, etc., across all `.css` files returns zero matches.

2. **Floating Parallax Orbs Coordinate Disregard**:
   In `frontend/src/components/cinematic-hero/FloatingVioletOrbs.tsx` lines 155-163:
   - `<motion.div className="absolute pointer-events-none" style={{ left: orb.x, top: orb.y, x, y }}>`
   Because `.absolute` does not exist in CSS, `position` defaults to `static`. Per CSS 2.1 / CSS Box Model specifications, `top` and `left` properties are completely ignored on statically positioned elements.

3. **Inverted Auto-Play Scroll Mathematics**:
   In `frontend/src/components/cinematic-hero/CinematicHeroSection.tsx` lines 84-86 & 124-127:
   - `const sectionTop = sectionRef.current.offsetTop;`
   - `const sectionHeight = sectionRef.current.offsetHeight - window.innerHeight;`
   - `const targetScroll = sectionTop + sectionHeight;`
   - `if (window.scrollY >= sectionTop + sectionHeight - 50)`
   Because `h-[360vh]` is uncompiled, `sectionRef.current.offsetHeight` is ~400px. With `window.innerHeight` = ~900px, `sectionHeight = 400 - 900 = -500px`. `targetScroll` is calculated as `sectionTop - 500px`, creating a negative scroll target. The reset check evaluates `scrollY >= negative number`, which is unconditionally true on page load.

4. **Dynamic Navbar Threshold Desynchronization**:
   In `frontend/src/pages/Landing.tsx` lines 198-199:
   - `const heroThreshold = window.innerHeight * 2.5;`
   - `setInHeroTrack(window.scrollY < heroThreshold);`
   - Line 225: `<Navbar visible={!inHeroTrack} />`
   The navbar reveal expects the hero to consume 2.5 to 3.8 viewports. Because the hero collapses to ~400px, the user scrolls past the Hero Section and the Interactive Demo before reaching 2.5 screen heights (~2500px), causing the navbar to remain hidden for over 2000px of content.

5. **Dead Navbar Anchor**:
   In `frontend/src/components/Navbar.tsx` line 12:
   - `{ href: '#interview-studio', label: 'Voice Studio' },`
   A search across `frontend/src` for `interview-studio` finds zero element IDs.

6. **Unstyled Waveform Telemetry in Sandbox Demo**:
   In `frontend/src/pages/Landing.tsx` lines 658-660:
   - `<div className="waveform-container">`
   - `<span key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.08}s`, height: `${h}px` }} />`
   Neither `.waveform-container` nor `.waveform-bar` is defined in any CSS file imported on the Landing page (`interview.css` is only imported inside `LiveInterview.tsx`).

7. **HUD Sandbox Tabs Horizontal Layout Overflow**:
   In `frontend/src/pages/Landing.tsx` lines 417-468:
   - The tabs wrapper `<div style={{ display: 'flex', alignItems: 'center', gap: 4, ... }}>` contains four wide buttons ("Resume Tailor & ATS", "Live Mock Interview", "LaTeX & PDF Maker", "Project Ideas"). Total child width is >610px without `flexWrap` or `overflowX: auto`.

8. **Intrinsic Image Size Explosion on Logo Reveal**:
   In `frontend/src/components/cinematic-hero/SmartApplyLogoReveal.tsx` lines 115-126:
   - `<img src="/logo.png" className="w-[140px] ... " style={{ maxWidth: '100%', height: 'auto', aspectRatio: '1 / 1' }} />`
   `logo.png` in `frontend/public/logo.png` is 611 KB and >512px wide. Without `w-[140px]`, the logo renders at 512px intrinsic width.

### 1.2 Live Interview Page Observations
9. **Acoustic Audio Feedback Loop (TTS -> STT)**:
   In `frontend/src/pages/dashboard/LiveInterview.tsx`:
   - Lines 602-628: `speakAIResponse` invokes `window.speechSynthesis.speak(utterance)` and sets `aiState = 'speaking'`.
   - Lines 682-728: `SpeechRecognition` runs continuously (`recognition.continuous = true`).
   - Lines 690-713: In `recognition.onresult`, when `finalSpeech` arrives, `generateAIResponse(text)` is triggered immediately without checking if `window.speechSynthesis.speaking` is active.

10. **Toast Notification Container Masked Behind Kiosk Screen**:
    In `frontend/src/components/Toast.tsx` line 46:
    - `style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, ... }}`
    In `frontend/src/styles/interview.css`:
    - Line 11: `.interview-layout { z-index: 9999; }`
    - Line 771: `.interview-setup-screen { z-index: 9999; }`
    - Line 1083: `.code-editor-container.fullscreen { z-index: 10000; }`

11. **Microservices Code Execution Endpoint Mismatch**:
    In `frontend/src/pages/dashboard/LiveInterview.tsx` line 189:
    - `apiFetch<CodeExecResponse>('/code/execute', ...)`
    In `frontend/src/api/client.ts` lines 51-58:
    - `cleanEndpoint.startsWith('/code-execution')` routes to `VITE_TOOLS_API_BASE_URL`.
    - Any path not matching falls through to `VITE_CORE_API_BASE_URL`.
    In `backend/core/main.py`, `code_execution` is NOT registered. It is only registered in `backend/tools/main.py:77`.

12. **Hardcoded Telemetry Payload in Disconnect Handler**:
    In `frontend/src/pages/dashboard/LiveInterview.tsx` lines 820-828:
    - `await apiFetch('/interview/analyze', { method: 'POST', body: JSON.stringify({ user_id: String(user.id), room_name: roomName, transcript: formattedTranscript, telemetry: { avg_confidence: 0.88, blink_count: 14 } }) });`

13. **Inverted Horizontal Tracking in Facial HUD**:
    In `frontend/src/pages/dashboard/LiveInterview.tsx`:
    - Line 1029: The webcam `<video>` has `transform: 'scaleX(-1)'` (mirrored).
    - Line 335: `ctx.drawImage(videoRef.current, 0, 0, width, height)` captures raw unmirrored video pixels.
    - Lines 401-406: `avgX < width * 0.38` is labeled `'Glancing Left'` and `avgX > width * 0.62` is labeled `'Glancing Right'`.

14. **Webcam Disable Performance Penalty**:
    In `frontend/src/pages/dashboard/LiveInterview.tsx` lines 396-435:
    When video is turned off (`isVideoOff = true`), the video track outputs black pixels (`skinPixels = 0`). The HUD branches to `else`, sets `confidenceScore = 68%`, `posture = 'Reposition Camera'`, and `gaze = 'Searching'`.

15. **Nyquist Frequency Sampling Failure for Blink Detection**:
    In `frontend/src/pages/dashboard/LiveInterview.tsx` line 452:
    The interval timer is `1200ms`. Human blinks average 100ms - 400ms.

16. **Pre-Call Mic Tester Dual Hardware Stream Leak**:
    In `frontend/src/pages/dashboard/LiveInterview.tsx` lines 106-153:
    `useMicTester` requests `getUserMedia({ audio: true })` and opens `AudioContext` with `requestAnimationFrame`. When `handleStart()` connects the call, a second `getUserMedia({ video: true, audio: true })` is opened. The initial stream and context are never closed until the entire page unmounts.

17. **Silent STT Failure on Firefox/Safari**:
    In `frontend/src/pages/dashboard/LiveInterview.tsx` line 730:
    When `SpeechRecognition` is undefined, `showToast` is called. Because the toast container has `zIndex: 999` and `.interview-layout` has `z-index: 9999`, the warning is hidden.

18. **Multi-Panel Layout Collapse on Mobile Viewports**:
    In `frontend/src/styles/interview.css` line 1417:
    `@media (max-width: 768px) { .interview-container { grid-template-columns: 1fr !important; } }`. When `isEditorOpen` or `isTranscriptOpen` is true, all panels are stacked into a single non-scrolling column with `overflow: hidden`.

### 1.3 General UI & Navigation Observations
19. **React Render-Phase Side Effect in `OtpVerify.tsx`**:
    In `frontend/src/pages/OtpVerify.tsx` lines 127-130:
    - `if (!email) { navigate('/signup'); return null; }`
    Calling `navigate()` synchronously during rendering violates React component purity and triggers runtime console errors.

20. **WebSocket Auto-Verify Auth State Desynchronization**:
    In `frontend/src/pages/OtpVerify.tsx` lines 41-47:
    - When `lastAuthEvent?.type === 'otp_verified'`, `navigate('/dashboard')` is called without calling `login(token, user)`.
    - In `frontend/src/components/ProtectedRoute.tsx` line 8, `isAuthenticated` checks `Boolean(user)`, which remains `null`. The user is immediately redirected to `/login`.

21. **Static Clock Loading Icon in `InterviewReport.tsx`**:
    In `frontend/src/pages/dashboard/InterviewReport.tsx` line 80:
    - `<Clock className="animate-spin" size={20} style={{ color: 'var(--accent)' }} />`
    `animate-spin` does not exist in the stylesheets; the project uses `.spin` (defined in `base.css:164`).

22. **Accidental Brace-Expansion Directory**:
    In `frontend/src/`, an empty directory `{api,context,hooks,components,pages/dashboard,styles}` exists from an unexpanded bash command.

---

## 2. Logic Chain

```
[Observation 1.1.1] Tailwind classes written in TSX but tailwindcss not in package.json/stylesheets
   └──> [Logic 1] Browser ignores uncompiled class selectors in CSSOM
         └──> [Conclusion 1] section#cinematic-hero collapses from 380vh to ~400px; .sticky, .absolute, .inset-0 fail
               └──> [Conclusion 2] Parallax animation scenes cannot interpolate; all layers stack as static blocks

[Observation 1.1.3] sectionHeight calculated as offsetHeight (400px) - innerHeight (900px)
   └──> [Logic 2] sectionHeight evaluates to -500px; targetScroll < sectionTop
         └──> [Conclusion 3] Auto-play scrolls upwards/backwards; reset condition triggers unconditionally

[Observation 1.1.4] heroThreshold set to window.innerHeight * 2.5 (~2500px)
   └──> [Logic 3] Hero is scrolled past in ~400px, but threshold check requires 2500px scroll travel
         └──> [Conclusion 4] Primary navbar remains hidden through the Hero and Interactive Demo

[Observation 1.1.5] Navbar targets '#interview-studio'
   └──> [Logic 4] No DOM element matches id='interview-studio'
         └──> [Conclusion 5] 'Voice Studio' link is completely dead

[Observation 1.2.9] SpeechRecognition listens continuously while SpeechSynthesis speaks aloud
   └──> [Logic 5] Microphone captures synthetic audio output from device speakers; onresult emits final text
         └──> [Conclusion 6] Recursive acoustic feedback loop causes AI interviewer to converse with itself

[Observation 1.2.10] Toast container has zIndex: 999; Interview screens have z-index: 9999
   └──> [Logic 6] CSS stacking context places Toast container beneath fullscreen interview layout
         └──> [Conclusion 7] All live interview toast notifications are completely invisible to users

[Observation 1.2.11] LiveInterview calls '/code/execute'; client.ts requires '/code-execution'
   └──> [Logic 7] Request routes to Core service instead of Tools service; Core lacks the router
         └──> [Conclusion 8] Code execution fails with HTTP 404 in microservices deployment

[Observation 1.2.12] Telemetry payload hardcoded to { avg_confidence: 0.88, blink_count: 14 }
   └──> [Logic 8] Live calculated metrics from FacialAnalysisHUD are discarded at call teardown
         └──> [Conclusion 9] Every database record and emailed performance report contains identical fake telemetry

[Observation 1.3.20] WebSocket 'otp_verified' navigates to dashboard without calling login()
   └──> [Logic 9] AuthContext user remains null; ProtectedRoute requires isAuthenticated == true
         └──> [Conclusion 10] Users verified via WebSocket are bounced directly back to /login
```

---

## 3. Detailed UI Bug Inventory

### Bug UI-01: 380vh Scroll Runway Collapse & Parallax Failure
- **Component**: `CinematicHeroSection.tsx` (Lines 146–149)
- **Steps to Reproduce**:
  1. Open the landing page (`/`).
  2. Attempt to scroll down to view the 7-scene cinematic sequence.
- **Expected Behavior**: A 380vh scroll runway holds the sticky hero in the viewport while typography separates and the logo reveals smoothly over scroll progress [0 to 1].
- **Actual Behavior**: Section height defaults to `auto` (~400px). Viewport is `position: static`. Scrolling moves past the entire section instantly; parallax transforms do not function.
- **Evidence**: `className="relative w-full h-[360vh] sm:h-[380vh] md:h-[400vh] bg-[#050308]"` has no matching CSS rules.
- **Severity**: Critical
- **Remediation**: Add explicit styles or CSS definitions: `style={{ minHeight: '380vh', position: 'relative' }}` and `.sticky-hero-viewport { position: sticky; top: 0; height: 100vh; overflow: hidden; background: #050308; }`.

### Bug UI-02: Normal-Flow Layer Stacking Glitch
- **Component**: `CinematicHeroSection.tsx` (Lines 152–186)
- **Steps to Reproduce**:
  1. Inspect the hero section DOM structure.
- **Expected Behavior**: Canvas particles, radial gradients, floating orbs, and vignette are positioned as `absolute inset-0` overlays on top of each other.
- **Actual Behavior**: `.absolute` and `.inset-0` are missing from CSS; all background elements stack vertically in normal document flow.
- **Severity**: Critical
- **Remediation**: Define `.absolute { position: absolute; }` and `.inset-0 { top: 0; right: 0; bottom: 0; left: 0; }` in `utilities.css`.

### Bug UI-03: Floating Parallax Orbs Coordinate Failure
- **Component**: `FloatingVioletOrbs.tsx` (Lines 155–163)
- **Steps to Reproduce**:
  1. Observe the background of the cinematic hero.
- **Expected Behavior**: Five ambient orbs float at their designated coordinate percentages (`left: 10%, top: 16%`, etc.).
- **Actual Behavior**: Because `position` is `static`, CSS ignores `left` and `top`. Orbs stack vertically as sequential block elements.
- **Severity**: High
- **Remediation**: Apply inline `style={{ position: 'absolute', left: orb.x, top: orb.y, x, y }}`.

### Bug UI-04: Auto-Play Cinematic Preview Inverted/Negative Scroll
- **Component**: `CinematicHeroSection.tsx` (Lines 84–101, 124–127)
- **Steps to Reproduce**:
  1. Click the "Cinematic Play" button in the top bar.
- **Expected Behavior**: Smooth automated scroll from top of hero (0vh) to bottom of hero (380vh).
- **Actual Behavior**: The page scrolls backwards/upwards into negative scroll position because `sectionHeight` is negative (-500px).
- **Severity**: High
- **Remediation**: Use `Math.max(window.innerHeight * 2.8, sectionRef.current.offsetHeight - window.innerHeight)` and ensure `targetScroll > startScroll`.

### Bug UI-05: Auto-Play Scroll Lock Without Cancellation on User Input
- **Component**: `CinematicHeroSection.tsx` (Lines 78–115)
- **Steps to Reproduce**:
  1. Click "Cinematic Play".
  2. While auto-play is running, attempt to scroll manually with mouse wheel or trackpad.
- **Expected Behavior**: Manual scroll cancels the auto-play animation immediately.
- **Actual Behavior**: `requestAnimationFrame` continues calling `window.scrollTo` every frame for 7.5 seconds, fighting user input and causing severe screen jitter.
- **Severity**: Medium
- **Remediation**: Attach `window.addEventListener('wheel', cancelAutoPlay, { passive: true })` and `window.addEventListener('touchstart', cancelAutoPlay, { passive: true })`.

### Bug UI-06: Dynamic Navbar Reveal Desynchronization
- **Component**: `Landing.tsx` (Lines 198–202)
- **Steps to Reproduce**:
  1. Scroll down the landing page.
- **Expected Behavior**: The sticky navbar reveals as soon as the user finishes the hero and enters the feature sections.
- **Actual Behavior**: The navbar is hidden until `window.scrollY >= 2.5 * window.innerHeight` (~2500px). The user scrolls past the entire hero and interactive demo with no navigation header.
- **Severity**: High
- **Remediation**: Calculate threshold dynamically from `landingContentRef.current.offsetTop - 80`.

### Bug UI-07: Dead Navigation Anchor `#interview-studio`
- **Component**: `Navbar.tsx` (Line 12)
- **Steps to Reproduce**:
  1. Scroll until the navigation bar is visible.
  2. Click the "Voice Studio" link in the navbar.
- **Expected Behavior**: Browser scrolls smoothly to the Voice Interview Studio section.
- **Actual Behavior**: No scroll occurs; the link points to `#interview-studio`, which does not exist in the DOM.
- **Severity**: Medium
- **Remediation**: Add `id="interview-studio"` to the Mock Interview section in `Landing.tsx` (or update link to `#features`).

### Bug UI-08: Missing Waveform Audio Visualization in Demo Sandbox
- **Component**: `Landing.tsx` (Lines 658–660)
- **Steps to Reproduce**:
  1. Scroll to the HUD Sandbox.
  2. Select the "Live Mock Interview" tab.
- **Expected Behavior**: An animated live audio waveform bar visualizes speech telemetry.
- **Actual Behavior**: The waveform container and spans have no CSS styling, rendering completely invisible.
- **Severity**: Medium
- **Remediation**: Add `.waveform-container` and `.waveform-bar` definitions to `components.css` or import `interview.css`.

### Bug UI-09: HUD Sandbox Navigation Tab Bar Severe Horizontal Overflow on Mobile
- **Component**: `Landing.tsx` (Lines 415–468)
- **Steps to Reproduce**:
  1. Open `/` on a mobile viewport (<640px width).
  2. Scroll down to the Interactive Demonstration card.
- **Expected Behavior**: Navigation tabs wrap cleanly or provide horizontal swipeable scroll.
- **Actual Behavior**: The tabs container requires >610px width and does not wrap or scroll, blowing out the right card margin.
- **Severity**: High
- **Remediation**: Add `flexWrap: 'wrap'` or `overflowX: 'auto'` to the tab container style.

### Bug UI-10: Unstyled Primary Hero CTA Button & Icons
- **Component**: `CinematicHeroSection.tsx` (Lines 300–304)
- **Steps to Reproduce**:
  1. Scroll to Scene 7 of the hero or view the bottom action area.
- **Expected Behavior**: Vibrant gradient pill button ("Explore Platform") with bouncing chevron.
- **Actual Behavior**: Renders as an unstyled browser button with black text against dark background; chevron icon does not bounce.
- **Severity**: High
- **Remediation**: Apply `.btn-primary` or explicit inline style with gradient background and `.bounce` animation.

### Bug UI-11: Logo Reveal Intrinsic Image Sizing Pop
- **Component**: `SmartApplyLogoReveal.tsx` (Lines 115–126)
- **Steps to Reproduce**:
  1. Load the hero section and observe the central logo.
- **Expected Behavior**: Logo scales smoothly from 68% up to 100% of ~170px width.
- **Actual Behavior**: Image lacks CSS width constraint and pops to its intrinsic 512px resolution.
- **Severity**: High
- **Remediation**: Add explicit `width: 'clamp(140px, 18vw, 210px)'` in the inline style.

### Bug UI-12: Particle Canvas Layout Thrashing
- **Component**: `CinematicParticleCanvas.tsx` (Lines 37–52)
- **Steps to Reproduce**:
  1. Move the mouse across the page while particles are rendering.
- **Expected Behavior**: Smooth 60 FPS particle animation without layout recalculations.
- **Actual Behavior**: `canvas.getBoundingClientRect()` is executed synchronously on every window `mousemove` event, forcing layout recalculation.
- **Severity**: Low
- **Remediation**: Cache the canvas bounding rect and only recompute on resize or scroll.

### Bug UI-13: Hardcoded Non-Token Colors on FAQ Accordion
- **Component**: `Landing.tsx` (Line 1117)
- **Steps to Reproduce**:
  1. Scroll to the FAQ section and expand an accordion item.
- **Expected Behavior**: Expanded item border uses the design system accent (`var(--accent)` / `var(--border-strong)`).
- **Actual Behavior**: Hardcoded `rgba(59, 130, 246, 0.35)` (Tailwind blue-500) overrides the electric violet theme.
- **Severity**: Low
- **Remediation**: Replace with `var(--accent-soft-border)` or `var(--border-strong)`.

### Bug UI-14: Continuous Acoustic Echo Feedback Loop (TTS -> STT)
- **Component**: `LiveInterview.tsx` (Lines 564–628, 678–750)
- **Steps to Reproduce**:
  1. Navigate to `/dashboard/live-interview`.
  2. Select any track and click "Launch Studio".
  3. Allow microphone and camera permissions.
  4. Wait for the AI interviewer to speak the greeting aloud.
- **Expected Behavior**: The AI speaks, finishes speaking, and then listens for the candidate's response.
- **Actual Behavior**: While the AI speaks through device speakers, `SpeechRecognition` captures the AI's voice, transcribes it, and posts it back to `/interview/respond`, initiating an infinite acoustic feedback loop.
- **Severity**: Critical
- **Remediation**: In `speakAIResponse`, stop or pause `SpeechRecognition` (set `isListeningRef.current = false; recognitionRef.current?.stop()`). In `recognition.onresult`, check `if (window.speechSynthesis.speaking) return;`. Resume recognition only in `utterance.onend`.

### Bug UI-15: Toast Notification Container Masked Behind Kiosk Screen
- **Component**: `Toast.tsx` (Line 46) vs `interview.css` (Line 11, 771, 1083)
- **Steps to Reproduce**:
  1. Launch a live interview session.
  2. Execute code in the Monaco editor or trigger a connection toast.
- **Expected Behavior**: Toast notification floats visibly in the top-right corner.
- **Actual Behavior**: Toast is rendered with `zIndex: 999` underneath the `z-index: 9999` kiosk layout and is completely invisible.
- **Severity**: High
- **Remediation**: Set `zIndex: 10005` on the toast container in `Toast.tsx`.

### Bug UI-16: Microservices Code Execution Routing Misalignment (404)
- **Component**: `LiveInterview.tsx` (Line 189) vs `client.ts` (Line 54)
- **Steps to Reproduce**:
  1. In a live interview session, open the code editor.
  2. Click "Execute".
- **Expected Behavior**: Code is posted to the Tools microservice (`VITE_TOOLS_API_BASE_URL`) where Judge0 execution is hosted.
- **Actual Behavior**: `cleanEndpoint.startsWith('/code-execution')` does not match `/code/execute`, so the request falls through to the Core service, which returns HTTP 404 Not Found.
- **Severity**: Critical
- **Remediation**: Update `client.ts` line 54 to check `cleanEndpoint.startsWith('/code') || cleanEndpoint.startsWith('/code-execution')`.

### Bug UI-17: Hardcoded Telemetry Payload in Report Generation
- **Component**: `LiveInterview.tsx` (Line 826)
- **Steps to Reproduce**:
  1. Complete a live interview and click "End Call".
  2. Inspect the network request payload to `/api/interview/analyze`.
- **Expected Behavior**: Actual calculated confidence average and blink count from `FacialAnalysisHUD` are sent to the backend.
- **Actual Behavior**: The payload always contains `{ avg_confidence: 0.88, blink_count: 14 }`.
- **Severity**: High
- **Remediation**: Pass a state updater or ref callback from `FacialAnalysisHUD` to `LiveInterview` to transmit real session telemetry.

### Bug UI-18: Inverted Horizontal Gaze & Posture Tracking in Facial HUD
- **Component**: `LiveInterview.tsx` (Lines 335, 401–406, 1029)
- **Steps to Reproduce**:
  1. In a live interview, look to the left side of your screen.
  2. Observe the AI Facial HUD readout.
- **Expected Behavior**: HUD displays "Glancing Left" / "Leaning Left".
- **Actual Behavior**: Because the video preview is mirrored with CSS `scaleX(-1)` while `drawImage` captures the unmirrored stream, the HUD reports "Glancing Right" / "Leaning Right".
- **Severity**: Medium
- **Remediation**: Invert the x-coordinate comparison: `if (avgX < width * 0.38) { gazeStatus = 'Glancing Right'; }`.

### Bug UI-19: Artificial Performance Penalty on Camera Mute
- **Component**: `LiveInterview.tsx` (Lines 396–435)
- **Steps to Reproduce**:
  1. In a live interview, click the "Turn Camera Off" button.
  2. Observe the AI Facial HUD readout.
- **Expected Behavior**: HUD states "Camera Paused" or retains last known score.
- **Actual Behavior**: HUD processes black frames, detects 0 skin pixels, drops confidence score to 68%, and flags posture as "Reposition Camera".
- **Severity**: Medium
- **Remediation**: Check `if (isVideoOff)` in `FacialAnalysisHUD` and display "Camera Off" with a neutral 85% reading.

### Bug UI-20: Blink Detection Nyquist Sampling Failure
- **Component**: `LiveInterview.tsx` (Line 452)
- **Steps to Reproduce**:
  1. Blink naturally during a live interview.
- **Expected Behavior**: Eye blinks are accurately registered in the blink counter.
- **Actual Behavior**: Sampling occurs every 1200ms, completely missing 200ms blinks and falsely triggering on ambient light shifts.
- **Severity**: Low
- **Remediation**: Increase sampling rate to 100ms for blink detection or use face landmark mesh.

### Bug UI-21: Pre-Call Mic Tester Dual Hardware Stream Leak
- **Component**: `LiveInterview.tsx` (Lines 106–153, 733)
- **Steps to Reproduce**:
  1. Open `/dashboard/live-interview` and click "Launch Studio".
  2. Inspect active MediaStreams and hardware microphone indicators.
- **Expected Behavior**: Pre-call tester stream is terminated when the active call begins.
- **Actual Behavior**: Both `useMicTester` and the active call stream run concurrently in the background, consuming dual audio tracks and animation frames.
- **Severity**: Medium
- **Remediation**: Pass `enabled={status === 'idle'}` to `useMicTester` and clean up tracks upon status transition.

### Bug UI-22: Silent STT Failure on Non-Chromium Browsers
- **Component**: `LiveInterview.tsx` (Lines 729–731)
- **Steps to Reproduce**:
  1. Open `/dashboard/live-interview` in Firefox or Safari and launch a call.
- **Expected Behavior**: A clear in-page alert or modal informs the user that browser speech recognition is not supported.
- **Actual Behavior**: A toast notification is fired but masked behind the `z-index: 9999` layout. The candidate speaks into the mic with zero feedback.
- **Severity**: High
- **Remediation**: Display an inline banner within `.ai-status-pill` when speech recognition is unsupported.

### Bug UI-23: Multi-Panel Layout Crushed on Mobile Viewports
- **Component**: `interview.css` (Line 1417)
- **Steps to Reproduce**:
  1. Open `/dashboard/live-interview` on a mobile screen (<768px).
  2. Connect to a call and open both the code editor and the transcript drawer.
- **Expected Behavior**: Panels switch via tabs or sliding full-screen overlays.
- **Actual Behavior**: Three panels stack vertically inside a fixed 100vh container with `overflow: hidden`, rendering Monaco and transcript unreadable.
- **Severity**: High
- **Remediation**: Use full-screen tabbed views or modals for editor and transcript on mobile viewports.

### Bug UI-24: Missing Reopen Editor Button on Non-Technical Tracks
- **Component**: `LiveInterview.tsx` (Line 1091)
- **Steps to Reproduce**:
  1. Launch an "HR" or "Behavioral" interview.
  2. When the AI requests code and opens the editor, close it using the 'X' button.
- **Expected Behavior**: A toolbar button allows reopening the code editor.
- **Actual Behavior**: The toolbar button is restricted to `{theme === 'Technical' && ...}`, leaving the user unable to reopen the editor.
- **Severity**: Low
- **Remediation**: Show the button whenever `theme === 'Technical' || isEditorOpen || conversationIncludesCode`.

### Bug UI-25: Incomplete Microphone Denied Permission UI State
- **Component**: `LiveInterview.tsx` (Lines 138–140, 887–890)
- **Steps to Reproduce**:
  1. On the setup screen, deny microphone permissions when prompted.
- **Expected Behavior**: UI displays "Microphone permission denied. Please allow microphone access in site settings."
- **Actual Behavior**: UI displays "Speak to test mic..." with an inactive meter, providing no explanation of the permission block.
- **Severity**: Medium
- **Remediation**: Add a `micError` state to `useMicTester` and show an explicit permission warning banner.

### Bug UI-26: React Render-Phase Side Effect in `OtpVerify.tsx`
- **Component**: `OtpVerify.tsx` (Lines 127–130)
- **Steps to Reproduce**:
  1. Navigate directly to `/verify-otp` in a new browser tab without location state.
- **Expected Behavior**: Smooth redirection to `/signup` or display of an email input field.
- **Actual Behavior**: `navigate('/signup')` is called directly in the render body, violating React's purity rules and triggering React Router warnings.
- **Severity**: Medium
- **Remediation**: Replace with `<Navigate to="/signup" replace />`.

### Bug UI-27: WebSocket Auto-Verify Auth State Desynchronization
- **Component**: `OtpVerify.tsx` (Lines 41–47)
- **Steps to Reproduce**:
  1. Open the OTP verification page in Tab A.
  2. Verify the OTP link in Tab B or trigger an `otp_verified` WebSocket event.
- **Expected Behavior**: Tab A automatically logs the user in and navigates to the dashboard.
- **Actual Behavior**: Tab A navigates to `/dashboard` without calling `login()`. `<ProtectedRoute>` intercepts the unauthenticated state and redirects the user back to `/login`.
- **Severity**: High
- **Remediation**: Call `login(lastAuthEvent.data.token, lastAuthEvent.data.user)` before navigating.

### Bug UI-28: Non-Spinning Clock Loading Icon in `InterviewReport.tsx`
- **Component**: `InterviewReport.tsx` (Line 80)
- **Steps to Reproduce**:
  1. Navigate to an interview report while analysis is in progress.
- **Expected Behavior**: Clock icon spins continuously to indicate active background processing.
- **Actual Behavior**: Icon remains static because `animate-spin` is an undefined Tailwind class.
- **Severity**: Low
- **Remediation**: Change `className="animate-spin"` to `className="spin"`.

### Bug UI-29: Standalone Hero Preview Back Button Detached from Viewport
- **Component**: `HeroPreview.tsx` (Lines 11–14)
- **Steps to Reproduce**:
  1. Navigate to `/hero-preview`.
- **Expected Behavior**: "Home" back button remains fixed in the top-left corner as the user scrolls.
- **Actual Behavior**: Button is positioned statically in document flow because `.fixed`, `.top-5`, `.left-5`, and `.z-50` are undefined Tailwind classes.
- **Severity**: Low
- **Remediation**: Use inline style: `style={{ position: 'fixed', top: 20, left: 20, zIndex: 50 }}`.

### Bug UI-30: Accidental Bash-Brace Directory Artifact in Source Tree
- **Component**: `frontend/src/{api,context,hooks,components,pages/dashboard,styles}`
- **Steps to Reproduce**:
  1. List subdirectories of `frontend/src/`.
- **Expected Behavior**: Clean source directory structure.
- **Actual Behavior**: An empty directory named `{api,context,hooks,components,pages` exists in the source tree.
- **Severity**: Low
- **Remediation**: Remove the directory with `rmdir`.

---

## 4. Caveats

- Audio feedback echo loops and speech recognition behaviors depend on browser implementations of the Web Speech API (`SpeechRecognition` / `SpeechSynthesis`), which are fully native to Chromium (Chrome, Edge, Brave) and absent or flagged in Firefox/Safari.
- GPU-accelerated canvas particle performance was evaluated under standard desktop browser viewports (1920x1080 and 1440x900) and mobile viewports (375x667 and 414x896).
- Microservice routing was verified against both monolith dev server configuration (`app.main:app`) and the 3-service split definitions in `backend/core`, `backend/ai`, and `backend/tools`.

---

## 5. Conclusion

The SMART APPLY UI layer possesses an exceptional modern design concept (cinematic hero runway, interactive HUD sandbox, live voice interview with vision HUD, and Monaco coding integration), but is severely compromised by three major categories of defects:

1. **Styling Architecture Disconnect**: Over 100 Tailwind CSS utility classes are written across `CinematicHeroSection.tsx`, `FloatingVioletOrbs.tsx`, `SmartApplyLogoReveal.tsx`, `HeroPreview.tsx`, and `InterviewReport.tsx`, despite Tailwind CSS never being installed or compiled. This causes the 380vh scroll runway to collapse to 400px, breaks sticky positioning, destroys the 7-scene parallax narrative, and leaves core buttons and icons unstyled.
2. **Audio/Media & Live Kiosk Logic Defects**: The live interview feature suffers from an acoustic echo feedback loop where the browser's TTS triggers its own STT listener in perpetuity, critical toast notifications are completely hidden underneath the `z-index: 9999` kiosk layout, facial telemetry metrics sent to the backend report are hardcoded (`{ avg_confidence: 0.88, blink_count: 14 }`), and code execution routing fails with HTTP 404 in microservices environments.
3. **Navigation & Authentication Desynchronization**: Dead anchors (`#interview-studio`), render-phase navigation calls in `OtpVerify.tsx`, and missing session token persistence during WebSocket auto-verification create broken routing loops.

Addressing these 30 prioritized defects will bring SMART APPLY to full production readiness.

---

## 6. Verification Method

To independently verify the observations and logic chain:

1. **Verify Missing Tailwind Classes**:
   - Check `frontend/package.json` for `tailwindcss` dependencies.
   - Run ripgrep for `h-[360vh]`, `.sticky`, `.absolute`, `.inset-0` across `frontend/src/styles/`:
     ```bash
     rg "h-\[360vh\]" frontend/src/
     rg "\.absolute" frontend/src/styles/
     ```
2. **Verify Dead Anchor**:
   - Inspect `frontend/src/components/Navbar.tsx:12` and search for matching DOM IDs across `frontend/src/`:
     ```bash
     rg "id=[\"']interview-studio[\"']" frontend/src/
     ```
3. **Verify Audio Loop Vulnerability**:
   - Inspect `frontend/src/pages/dashboard/LiveInterview.tsx` lines 564–628 and lines 690–713 to confirm `SpeechRecognition` has no gating against `window.speechSynthesis.speaking`.
4. **Verify Z-Index Inversion**:
   - Compare `frontend/src/components/Toast.tsx:46` (`zIndex: 999`) against `frontend/src/styles/interview.css:11` (`z-index: 9999`).
5. **Verify Microservices Routing Mismatch**:
   - Compare endpoint string in `frontend/src/pages/dashboard/LiveInterview.tsx:189` (`/code/execute`) against the routing condition in `frontend/src/api/client.ts:54` (`cleanEndpoint.startsWith('/code-execution')`).
6. **Verify Hardcoded Telemetry**:
   - Inspect `frontend/src/pages/dashboard/LiveInterview.tsx:826` to confirm `{ avg_confidence: 0.88, blink_count: 14 }`.
