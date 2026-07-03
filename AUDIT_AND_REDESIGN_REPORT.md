# SmartApply — Audit & Brutalist Redesign Report

Full read-through of every backend and frontend file, followed by fixes for
everything confirmed broken, and a complete pass to finish the Neo-Brutalist
design system consistently across the app. Everything below was verified,
not assumed — TypeScript compiles clean, `vite build` succeeds, the FastAPI
app imports cleanly, and every CSS variable/utility class used in the code
is now backed by a definition.

---

## 1. Backend bugs found and fixed

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `livekit_chunked_stream.py` | Orphaned file, saved as **UTF-16**, so any UTF-8-based tool (linter, `py_compile`, grep) chokes with a null-byte error. It's a leftover excerpt from the `livekit-agents` library (references `TTS`, `APIConnectOptions` etc. that are never imported) and isn't imported anywhere in the app. | Removed. |
| 2 | `routers/resume.py` (`POST /api/resumes`, the endpoint the app actually uses for uploads) | Called `storage_service.upload_file()` — a **synchronous, blocking `boto3` call** — directly inside an `async def` route, blocking the whole event loop for the duration of every R2 upload. `upload_avatar` in `upload.py` correctly wrapped the same call in `run_in_threadpool`; this one didn't. | Wrapped in `run_in_threadpool`. |
| 3 | `routers/upload.py` | `POST /api/upload/resume` was a **dead, duplicate endpoint** — the frontend only ever calls `POST /api/resumes`. It also had the same blocking-call bug as #2. | Removed (kept `/api/upload/avatar`, which was correct). |
| 4 | `routers/stats.py` | Dashboard's "Average ATS Score" was **hardcoded to `85`** for any user with ≥1 resume — not computed from anything. | Added `ats_score` to the `Resume` model, persisted it whenever `/api/ai/ats-check` is run against a saved resume, and now compute a real average from scored resumes (0 if none scored yet). |
| 5 | `routers/resume.py` (`DELETE /{resume_id}`) | Deleting a resume never (a) reassigned `is_primary` if the deleted resume was primary, leaving the user with **no primary resume**, or (b) deleted the file from R2, so **every deleted resume's file leaked in storage forever**. | Added `file_key` to the `Resume` model (stored at upload time); deletion now removes the R2 object and promotes the next-most-recent resume to primary. |
| 6 | `routers/user.py` (`GET /api/user/profile`) | Response omitted `linkedin_url`, `github_url`, `portfolio_url`, `education`, `experience` — fields that exist on the model and are returned by `PUT /profile`. Currently low-impact since the frontend hydrates from the auth/login payload instead of calling this endpoint, but it's a real API-contract gap. | Response now includes the full field set. |
| 7 | `routers/ai.py` (`POST /api/ai/ats-check`) | The `try/except Exception` around the resume lookup also caught the `HTTPException(404, "Resume not found")` raised *inside* the same `try` block, silently turning a correct 404 into a misleading `400 Invalid resume ID`. | Re-raise `HTTPException` before the generic `except`. |
| 8 | `routers/interview.py` | User lookup did `User.find_one({"_id": data.user_id})` with a **raw string** against an ObjectId field — this query can never match, so it always fell through to a second, correct, `ObjectId(...)`-cast query. Dead code, always executes twice. | Removed the always-failing first query. |
| 9 | `routers/interview.py` | `report.dict()` — deprecated Pydantic v1 method. | `report.model_dump()`. |
| 10 | `routers/auth.py` (websocket push events) | `login_success` and `otp_verified` events omitted `id` (and `profile_pic_url`), which `AuthContext.tsx` reads to build the logged-in user object — any login driven by the websocket push path ended up with an **empty user ID**. | Both events now include `id` and `profile_pic_url`. |
| 11 | `hooks/useAuthSocket.ts` + `main.py` router mounting | The auth websocket is mounted at `/api/ws/auth/{session_id}` (`app.include_router(ws_router, prefix="/api")`), but the frontend connected to `/ws/auth/{session_id}` — **missing `/api`**. The Vite dev proxy only forwarded bare `/ws` too. In both dev and prod this meant the real-time OTP/login push channel **never connected**. The core login/signup flow still works because it also submits via plain REST and only *upgrades* to the push channel — so this was silent rather than fatal, but the "real-time" feature was fully non-functional. | Fixed the URL to include `/api`, fixed the Vite proxy to forward `/api` (with `ws: true`) instead of a non-existent bare `/ws` route. |

## 2. Frontend bugs found and fixed

### Functional bugs

| # | Location | Issue | Fix |
|---|----------|-------|-----|
| 1 | `Toast.tsx` | Computed a per-type background color (`c.bg`) but never used it — `background` was hardcoded to `var(--bg-card)`, so success/error/info toasts all looked identical apart from a thin border. | Now actually uses `c.bg`. |
| 2 | `pages/dashboard/Home.tsx` | "Generate Portfolio" quick-action linked to `/dashboard/portfolio-generator`, a route that **doesn't exist anywhere in `App.tsx`** — clicking it silently fell through to the catch-all route and redirected to the landing page. | Pointed at the resume tailoring flow instead. |
| 3 | `components/DashboardLayout.tsx` | Page titles used a `.text-shiny` gradient-clip animation, but an inline `style={{ color: '#000' }}` on the same element **overrode the class's `color: transparent`**, so the gradient never actually rendered — just a wasted, invisible animation running on every dashboard page. | Removed the dead effect; titles now use a deliberate flat offset-shadow treatment consistent with the rest of the design system. |
| 4 | `components/LoadingSpinner.tsx` | File-wide **mojibake** in comments (box-drawing characters corrupted into `â•â•â•...` sequences, plus `Â·`), from an encoding round-trip gone wrong. Comments only, no runtime effect, but unclean. | Re-saved as clean UTF-8 with normal ASCII banners; also normalized CRLF → LF (the file had Windows line endings throughout). |

### Black-on-black contrast bug (found in three separate places)

The same mistake — setting an element's background to `var(--text-primary)` (black) while leaving its foreground text/icon color also black — showed up three times, each making real content invisible:

1. **`dashboard.css` `.chat-bubble.user`** — every message *you* send in the AI Chatbot rendered black-on-black.
2. **`dashboard.css` `.profile-avatar`** — a user's initials (the fallback shown before they upload a photo — the default state for every new account) rendered black-on-black.
3. **`landing.css` `.resume-button`** — the landing page's expanding CTA button: both the label text and the arrow icon rendered black-on-black. This one is on the public marketing page.

All three now use proper contrast (accent-yellow background for the chat bubble and avatar, white text/icon for the CTA button).

### Missing/incomplete styling

| # | Issue | Fix |
|---|-------|-----|
| 1 | **17 CSS custom properties** (`--accent-secondary`, `--accent-soft`, `--accent-start`, `--accent-yellow`, `--bg-body`, `--bg-card-hover`, `--bg-elevated`, `--bg-surface`, `--border`, `--border-accent`, `--error-bg`, `--primary`, `--primary-foreground`, `--shadow-inset`, `--shadow-raised`, `--success-bg`, `--transition-fast`) were referenced in **50+ places** across every CSS file and several components' inline styles, but never defined in `:root` — a leftover from an incomplete migration off an older design system. Every one of these silently produced no styling wherever it was the *only* source of a property's value (invisible tag backgrounds, invisible skeleton loaders, invisible scrollbar thumbs, etc.). | All 17 are now defined for both light mode and the (functional, user-toggleable in Settings) dark theme. |
| 2 | **A much larger issue than the CSS variables**: dozens of components use Tailwind-style utility classNames (`flex`, `grid`, `gap-4`, `items-center`, `text-2xl`, `space-y-4`, `md:grid-cols-2`, `rounded-full`, etc. — 65 distinct tokens) throughout the dashboard and landing pages, but **this project has no Tailwind CSS installed** (confirmed: not in `package.json`, no config file, no CDN script) and no custom utility stylesheet defined them either. Concretely, e.g. `InterviewReport.tsx`'s loading state used `className="flex flex-col items-center justify-center h-full space-y-4"` with zero corresponding CSS — it would have rendered as plain stacked, left-aligned, unspaced elements instead of a centered loading state. | Added a hand-written utility layer to `index.css` covering exactly the 65 tokens actually used in the codebase, built on the existing design tokens (so `rounded-lg`/`rounded-xl` stay square per the brutalist system, `rounded-full` stays a true circle for avatars, colors map to `--accent-blue`/`--success`/etc. rather than literal Tailwind hex values). |
| 3 | `landing.css` `.glass-bubble` — the small floating "ATS Check" / "Interview" labels next to the hero wordmark had **no CSS at all**; they would have rendered as bare unstyled text with no container, badge shape, or icon/text spacing. | Added a proper brutalist chip: solid accent background, black border, hard offset shadow. |
| 4 | `landing.css` `.hero-badge` | Confirmed **unused** in current JSX (dead CSS), but fixed anyway for consistency: its border and glow used `rgba(255,255,255,...)`, a leftover from a dark theme, nearly invisible against the light background. | |

### Skeuomorphic remnants cleaned up (visual consistency, not "broken" but off-brand)

Beyond the bugs above, several elements still carried soft blur/glow/inset effects from an older, different visual language that this codebase was partway through migrating away from — inconsistent with the flat, hard-edged Neo-Brutalist system used everywhere else:

- `dashboard.css` — the AI Chatbot's `.modal` was a **glassmorphic dark panel** (`backdrop-filter: blur(24px)`, translucent near-black background) sitting inside an otherwise light, opaque, brutalist app. Rebuilt as a solid white panel with a hard black border and offset shadow, matching every other card/modal in the app.
- Soft blurred `text-shadow` and `box-shadow: inset ...` remnants removed from: dashboard page headers, ATS score display, question/feedback cards, settings card headings, the typing indicator, quick-prompt chips, markdown code blocks, and the auth page's link hover states.
- `dashboard.css`'s file header comment still literally read "Dashboard Styles — **Skeuomorphic**" — updated to reflect what it now actually is.
- Normalized CRLF line endings to LF in `dashboard.css` and `LoadingSpinner.tsx` (the rest of the codebase was already LF; mixed endings are just housekeeping, not a functional bug).

## 3. What the redesign *kept*

The codebase had already committed to a specific, well-thought-out Neo-Brutalist
direction — hard black borders, offset drop shadows with zero blur, a
yellow/pink/blue/green accent palette, `Space Grotesk` display type paired with
`Inter` body text and `JetBrains Mono` for data readouts, and a strict
`border-radius: 0` system. That direction was already good and matches the
brief; the work here was to *finish* applying it consistently and fix the
places where it had regressed to the older look, rather than replace it with
something else.

## 4. Verification performed

- `npx tsc --noEmit` — passes, no type errors.
- `npx vite build` — succeeds, no build errors or warnings besides the
  pre-existing "large chunk" advisory (a code-splitting opportunity, not a bug —
  see recommendations below).
- `python3 -m py_compile` across every backend file — all pass.
- Full FastAPI app import with all routers — succeeds.
- Scripted diff of every `var(--...)` reference across all `.css`/`.tsx` files
  against everything actually defined in `:root` — zero undefined variables
  remain.
- Scripted diff of every `className` token used across all `.tsx` files
  against every selector defined in the CSS files *and* each component's
  embedded `<style>` blocks — everything is either properly styled or
  confirmed to be a harmless vestigial class name on an element that's fully
  inline-styled anyway.

## 5. Not changed, worth knowing about

A few things came up during the audit that are either out of scope for a
frontend redesign, or judgment calls better left to you:

- **Bundle size**: the production JS bundle is ~1.99 MB (532 KB gzipped),
  and Vite flags it as large. The app isn't code-split by route — every
  dashboard page, the LaTeX/PDF tooling, and the AI chat UI all load in one
  chunk regardless of which page is visited first. Converting the page
  imports in `App.tsx` to `React.lazy()` would likely cut the initial load
  significantly. Didn't do this since it changes loading/suspense behavior
  app-wide and is a separate concern from visual design.
- **`main.tsx`'s crash fallback** shows a raw JS stack trace to end users on
  any uncaught render error. Fine for local development, but worth a
  friendlier production fallback at some point.
- **Modal implementation is inconsistent**: `dashboard.css` defines a proper
  `.modal` / `.modal-overlay` system, but `ImageCropModal.tsx` and the
  delete-account confirmation in `Settings.tsx` use `className="modal-content"`
  (never defined) and get all their actual styling from inline `style` props
  instead. It works today because the inline styles are complete, but it's
  worth consolidating onto one system rather than two.
- **Dead code**: a few unused exports (`OrbitSpinner`, `BrutalSpinner`,
  `BouncingDots` in `LoadingSpinner.tsx`) and unused CSS (`.tag`/`.tag-success`/
  `.tag-error`/`.tag-accent`) are still present. Left them in place rather than
  deleting, since removing unused-but-harmless code wasn't the ask — flagging
  here in case you want them gone.
