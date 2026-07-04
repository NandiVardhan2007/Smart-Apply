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
| 6 | `routers/user.py` (`GET /api/user/profile`) | Response omitted `linkedin_url`, `github_url`, `portfolio_url`, `education`, `experience` — fields that exist on the model and are returned by `PUT /profile`. This is more impactful than it looks at first glance: `Profile.tsx` calls this endpoint on every mount specifically to restore a returning user's saved profile data, because the login/signup response only carries identity fields (id, email, name, verification status). Before this fix, a user who filled out their bio/skills/education/experience/social links in one session would see all of those fields **blank again** the next time they logged in and opened the Profile page — the data was safely in the database the whole time, just never sent back by this endpoint. | Response now includes the full field set. |
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

### Black-on-black contrast bug (found in three places, two of them live)

The same mistake — setting an element's background to `var(--text-primary)`
(black) while leaving its foreground text/icon color also black — showed up
three times. I initially reported all three as live bugs; checking each
against the original files more carefully, only two actually render:

1. **`dashboard.css` `.profile-avatar`** (live) — a user's initials (the
   fallback shown before they upload a photo — the default state for every
   new account) rendered black-on-black. Used in `Profile.tsx`.
2. **`landing.css` `.resume-button`** (live) — the landing page's expanding
   CTA button: both the label text and the arrow icon rendered black-on-black.
   This one is on the public marketing page. Used in `Landing.tsx`.
3. **`dashboard.css` `.chat-bubble.user`** — I fixed this and reported it as
   live, but it isn't: `AiChatbot.tsx` builds its message bubbles with inline
   styles and never applies this class at all. It's dead CSS with no visitor
   ever seeing it. Still fixed for correctness/consistency, but it wasn't
   actually broken for anyone.

Both live instances now use proper contrast (accent-yellow background with
black text for the avatar, white text/icon for the CTA button).

### Missing/incomplete styling

| # | Issue | Fix |
|---|-------|-----|
| 1 | **17 CSS custom properties** (`--accent-secondary`, `--accent-soft`, `--accent-start`, `--accent-yellow`, `--bg-body`, `--bg-card-hover`, `--bg-elevated`, `--bg-surface`, `--border`, `--border-accent`, `--error-bg`, `--primary`, `--primary-foreground`, `--shadow-inset`, `--shadow-raised`, `--success-bg`, `--transition-fast`) were referenced in **50+ places** across every CSS file and several components' inline styles, but never defined in `:root` — a leftover from an incomplete migration off an older design system. Every one of these silently produced no styling wherever it was the *only* source of a property's value (invisible tag backgrounds, invisible skeleton loaders, invisible scrollbar thumbs, etc.). | All 17 are now defined for both light mode and the (functional, user-toggleable in Settings) dark theme. |
| 2 | **A much larger issue than the CSS variables**: dozens of components use Tailwind-style utility classNames (`flex`, `grid`, `gap-4`, `items-center`, `text-2xl`, `space-y-4`, `md:grid-cols-2`, `rounded-full`, etc. — 65 distinct tokens) throughout the dashboard and landing pages, but **this project has no Tailwind CSS installed** (confirmed: not in `package.json`, no config file, no CDN script) and no custom utility stylesheet defined them either. Concretely, e.g. `InterviewReport.tsx`'s loading state used `className="flex flex-col items-center justify-center h-full space-y-4"` with zero corresponding CSS — it would have rendered as plain stacked, left-aligned, unspaced elements instead of a centered loading state. This one is fully live — `InterviewReport.tsx` is built almost entirely out of these utility classes. | Added a hand-written utility layer to `index.css` covering exactly the 65 tokens actually used in the codebase, built on the existing design tokens (so `rounded-lg`/`rounded-xl` stay square per the brutalist system, `rounded-full` stays a true circle for avatars, colors map to `--accent-blue`/`--success`/etc. rather than literal Tailwind hex values). |
| 3 | `landing.css` `.glass-bubble` (live, on the landing page) — the small floating "ATS Check" / "Interview" labels next to the hero wordmark had **no CSS at all**; they would have rendered as bare unstyled text with no container, badge shape, or icon/text spacing. | Added a proper brutalist chip: solid accent background, black border, hard offset shadow. |
| 4 | `landing.css` `.hero-badge` | Confirmed **unused** in current JSX (dead CSS), but fixed anyway for consistency: its border and glow used `rgba(255,255,255,...)`, a leftover from a dark theme, nearly invisible against the light background. | |

### Dashboard.css: a live stylesheet mixed with a lot of dead one

Once I checked every class in `dashboard.css` against actual usage in the
original files, a clear pattern emerged: several dashboard features
(the AI chatbot, the ATS score display, and what looks like an earlier
text-based interview Q&A flow that was later replaced by the live
voice/video interview) were **rewritten at some point to use inline styles
directly in the component**, and the old CSS classes were never removed.
Concretely, none of these are referenced by any component in the original
upload: `.chat-bubble`, `.chat-messages`, `.typing-indicator`,
`.quick-prompt`, `.modal` (note: *not* `.modal-overlay`, which is live),
`.question-card`, `.feedback-section`, `.improved-answer`,
`.suggestion-item`, `.ats-score-circle`, `.ats-score-value`.

This matters for how to read the "skeuomorphic remnants cleaned up" work
from the first pass — I fixed the soft blur/glow/inset effects on all of
these, but it's worth being accurate that most of them were dead code, not
live bugs:

- **Live and actually fixed**: `feedback-score-bar` / `feedback-score-fill`
  (used by `Profile.tsx`'s completion-percentage bar — the inset shadow
  removal is a real, visible change), `.danger-zone` (used by `Settings.tsx`),
  `.profile-avatar`, `.ats-layout` (the ATS Checker's grid container, still
  in use — only the score *display* inside it turned out to be dead CSS),
  dashboard page headers, and the sidebar/nav styling.
- **Dead code, fixed for consistency but not previously visible to anyone**:
  the chat bubble/typing-indicator/quick-prompt system, `.modal`'s
  glassmorphic panel, the question-card/feedback-section/improved-answer/
  suggestion-item group, and the ATS score circle/value display.

None of this changes what got fixed — a coherent, fully-defined design
system is worth having regardless of which classes happen to be wired up
today — but it does change how much of it was an active bug versus general
cleanup, and I'd rather flag that correction than leave the overstated
version standing.

Also normalized CRLF line endings to LF in `dashboard.css` and
`LoadingSpinner.tsx` (the rest of the codebase was already LF; mixed endings
are just housekeeping, not a functional bug), and updated `dashboard.css`'s
file header comment, which still literally read "Dashboard Styles —
**Skeuomorphic**".

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

- **Dead code**: `.tag`/`.tag-success`/`.tag-error`/`.tag-accent` and
  `.skeleton`/`.skeleton-line`/`.skeleton-circle` in `index.css` aren't used
  by any component right now. Left them in — they're now correctly built
  and are reasonable, reusable pieces of the design system for whenever a
  tag/chip or skeleton loader is needed.

## 6. Follow-up pass

A second pass addressed the items above that were worth fixing rather than just flagging:

- **Bundle size / code-splitting.** The dashboard pages (plus Onboarding) are
  now loaded via `React.lazy()` instead of being bundled into the initial
  chunk. This mattered more than the original report suggested: the
  **before** bundle was a single 1.99 MB chunk downloaded by every visitor,
  signed in or not. **After** splitting, the initial chunk a signed-out
  visitor downloads is 428 KB (133 KB gzipped) — a ~78% reduction — and the
  Live Interview page (which pulls in `face-api` models and other heavy
  dependencies) is isolated into its own 1.3 MB chunk that only loads if
  someone actually visits it. `App.tsx` now wraps the router in a
  `<Suspense>` boundary with a centered spinner fallback.
- **Production error boundary.** `main.tsx`'s crash fallback now checks
  `import.meta.env.DEV`: in development it still shows the full stack trace
  (useful while building), but in production it shows a plain, on-brand
  "Something Went Wrong" panel with a reload button instead of a raw error
  dump.
- **Modal consolidation.** `ImageCropModal.tsx` and the delete-account
  confirmation in `Settings.tsx` now use the real `.modal-overlay` / `.modal`
  classes (matching every other modal in the app) instead of the
  never-defined `modal-backdrop` / `modal-content` names that only worked
  because of duplicated inline styles. Same visual result, one system instead
  of two.
- **Dead code removed.** `BrutalSpinner` (an unused alias) is gone.
  `OrbitSpinner` and `BouncingDots` are still used *internally* by other
  exports in `LoadingSpinner.tsx`, so rather than delete them outright they've
  been made module-private (dropped the `export` keyword) since nothing
  outside that file was importing them by name.

## 7. Third pass — remaining pages read line-by-line

The first pass covered every backend file and the shared frontend
infrastructure (API client, CSS system, auth context, routing) in full, and
spot-checked the remaining pages' API calls against the backend routes. This
pass went back and read every remaining page fully, end to end.

**The most important finding was in `LiveInterview.tsx`, and it's more severe
than the auth websocket bug from the first pass:**

The Live Interview feature opens its own WebSocket directly to the backend
(separate from the auth push channel). Its URL was built two different ways
depending on environment:

- **Local dev** (no `VITE_API_BASE_URL` set): correctly built
  `/api/interview/ws/chat`.
- **Production** (`VITE_API_BASE_URL` set, per `render.yaml`): built
  `{base}/interview/ws/chat` — **missing `/api`**, the same mistake as the
  auth socket, but in the opposite branch.

The interview router is mounted at `/api/interview` (`APIRouter(prefix="/api/interview")`
in `routers/interview.py`), so the real-time interview chat socket would
**never have connected once deployed**. Unlike the auth push channel, there's
no REST fallback here — the whole point of this page is a live, bidirectional
conversation over the socket. This would have made the flagship "AI video
interview" feature completely non-functional in production while looking
fine in local dev, which is exactly the kind of bug that's easy to miss
without deploying and testing against a real backend URL. Fixed to use
`/api/interview/ws/chat` in both branches.

Everything else read clean:
- `Onboarding.tsx`, `Signup.tsx`, `ResetPassword.tsx` — no functional issues.
  Fixed one small inconsistency: the skill-tag chips in `Onboarding.tsx` still
  had a soft inset-shadow "carved" look left over from the old design; now
  matches the flat, hard-bordered tag style used everywhere else.
- `AtsChecker.tsx` — no functional issues; removed a redundant duplicate
  `getScoreColor()` function (an identical one already exists at module scope).
- `ProjectRecommender.tsx` — no issues found.
- `InterviewReport.tsx` — this page is built almost entirely out of the
  Tailwind-style utility classes described in section 2 (`flex`, `grid-cols-1
  md:grid-cols-3`, `border-l-4 border-l-green-500`, `bg-green-500/20`, etc.)
  with very few custom classes. It's a good confirmation that the utility
  layer fix mattered: before it, this entire report page would have rendered
  as unstyled, unaligned text with no cards, no grid, and no color coding.

## 8. Fourth pass — more pages read fully, a correction, and a bug I introduced myself

This pass finished the remaining pages that hadn't been read end-to-end yet
(`Profile.tsx`, `Settings.tsx`, `AiChatbot.tsx`, `Landing.tsx`, and the rest
of `LoadingSpinner.tsx`), and turned up a few things worth calling out
specifically.

### A severity correction: `GET /user/profile` is live, not dead

While reading `Profile.tsx` in full, I found the `useEffect` that calls
`GET /api/user/profile` on mount — I'd missed it earlier and reported in
section 1 that the frontend never calls this endpoint. That was wrong. It
does call it, specifically to restore bio/skills/education/experience/social
links for a returning user, since the login response doesn't carry them.
`updateUser()` merges rather than replaces state, so the missing fields
never actively erased anything, but they also never got restored — a
returning user's saved profile details would show up blank every time they
logged back in, until this pass's earlier backend fix (section 1, #6). The
table in section 1 now reflects this correctly.

### A recurring bug pattern: false "success" messages on real failures

`apiFetch()` only throws on network-level failures (DNS, connection refused,
etc.) — for an HTTP error response like a 400 or 401, it resolves normally
with `{ ok: false, ... }`. Three places called it and assumed a resolved
promise meant success, so they'd show a success message and proceed even
when the backend explicitly rejected the request:

- **`Settings.tsx` password change** — entering the wrong current password
  (which the backend correctly rejects with a 400) still showed "Password
  updated successfully."
- **`Settings.tsx` account deletion** — same pattern on a destructive,
  irreversible action; a failed delete would still log the user out and
  claim the account was scheduled for deletion.
- **`OtpVerify.tsx` resend OTP** — the endpoint is rate-limited
  (`3/minute`) and can 404 for an unknown email; either case still reset the
  60-second countdown and showed "a new OTP has been sent."

All three now check `res.ok` before showing success and surface the
backend's actual error message otherwise. Fixed the same pattern in
`LiveInterview.tsx`'s post-interview report generation too, for consistency,
though it's lower-stakes there (worst case is landing on a report page that
never finishes processing rather than a false claim about a security-sensitive action).

### Account deletion didn't actually delete the account's data

Related to the above: `DELETE /api/user/account` only ever deleted the
`User` document itself. The Settings page tells the user this erases "your
data, resumes, and interview history" — it didn't. Resume files stayed in R2
forever, `Resume` documents stayed in MongoDB with a `user_id` pointing at
nothing, and `InterviewReport` documents were never touched either. Fixed
`delete_account` to walk the user's resumes (deleting each R2 file and DB
record) and bulk-delete their interview reports before removing the user,
so the promise made in the UI is actually true.

### A bug I introduced myself, in the utility-layer work from section 2

`Landing.tsx`'s root wrapper has `className="... bg-primary text-primary-foreground"`.
Following the standard shadcn/Tailwind convention, I'd mapped `.bg-primary`
to `var(--primary)` (black) and left `.text-primary-foreground` undefined —
reasonable in isolation, since that's also the convention the
`LiveInterview.tsx` coding-mode toggle already used for the same
`--primary`/`--primary-foreground` pair. But that toggle references the CSS
variables directly via inline `style`, not through these utility classes,
and it turns out `bg-primary`/`text-primary-foreground` are used *nowhere
else* in the app except this one wrapper. Every single piece of text inside
it — the hero headline, the stat numbers, the nav — is colored for a light
background (black or muted-gray text, no white anywhere except one button
with its own explicit black background). Mapping `.bg-primary` to black
turned the entire landing page's background solid black behind text that
assumes it's light — a real regression, and one I introduced rather than
inherited. Since this pairing has exactly one call site in the whole
codebase, I remapped it to the page's actual light background and dark text
instead of the brand black/white pairing, which matches what every other
element on the page was already built assuming. Caught this by re-reading
`Landing.tsx` end to end rather than trusting my earlier utility-class
choices without checking every call site — worth being upfront that it
happened rather than quietly folding it into the pile of pre-existing bugs.

### A few smaller things from the same pass

- Two more instances of the dark-theme `rgba(255,255,255,0.1)` divider-line
  remnant in `Landing.tsx` (stats section and footer), same pattern as the
  `hero-badge` fix in section 2 — replaced with a visible border color.
- `.text-primary` (distinct from `.text-primary-foreground`) was used on the
  landing page's stat numbers and footer wordmark but was never defined;
  added it.
- A mojibake character actually rendered in the UI this time, not just in a
  comment: `LoadingSpinner.tsx`'s step-completion checkmark had been
  corrupted into the literal text `âœ"` — anyone watching a processing
  step complete would have seen that garbled string instead of a checkmark.
  Fixed to a proper `✓`. Re-swept the entire frontend and backend afterward
  for the same byte-corruption pattern; nothing else turned up.
- `Onboarding.tsx`'s skill-tag chips had the same soft inset-shadow "carved"
  remnant fixed elsewhere; brought them in line with the flat tag style used
  everywhere else.
- Removed a redundant duplicate `getScoreColor()` in `AtsChecker.tsx`
  (an identical one already exists at module scope).

Re-verified again the same way: `tsc --noEmit`, `vite build`, and the
FastAPI import all pass clean.
