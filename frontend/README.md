# Smart Apply — Frontend

A minimalist, editorial-styled frontend for Smart Apply, the AI-powered job
application platform. Built from scratch with React 19, TypeScript, and Vite.

## Design system

The visual language is intentionally restrained: one accent color, ink-on-paper
neutrals, and hairline borders instead of shadows. Type pairs a display face
for headings with **Inter** for interface text and **JetBrains Mono** for
anything numeric or technical — ATS scores, timestamps, stat counters — a
small nod to the engineering audience the product serves.

All design tokens live in `src/styles/tokens.css` as CSS custom properties.
Motion also has shared tokens (`--transition-fast/base/slow`, `--ease`,
`--ease-out`) so every hover, focus, and theme change decelerates the same
way — that consistency is a large part of what makes an interface feel
smooth rather than just "animated."

### Themes

Three themes ship out of the box — **Light**, **Dark**, and **Ice** — switchable
from the segmented control in Settings, the sidebar footer, or the public
navbar. `ThemeContext` persists the choice to `localStorage` and applies it
via a `data-theme` attribute on `<html>`; a small inline script in
`index.html` reads that value before React even mounts, so there's no flash
of the wrong theme on load.

Each theme only ever redefines the same variable names, so no page needs
theme-specific code. **Ice** is the one theme that also swaps
`--font-display` to Space Grotesk for a distinct, modern-geometric heading
style, while body copy stays on Inter like every other theme — consistent
interface text everywhere, with just the display type carrying each theme's
personality. Every theme's palette is checked against WCAG's contrast
formula to stay at or above the ~4.5:1 bar for normal text.

Icons are from [lucide-react](https://lucide.dev) throughout the interface,
with [react-icons](https://react-icons.github.io/react-icons/) (Font Awesome
set) used specifically for official brand marks — GitHub and LinkedIn — on
the Profile page.

## Project structure

```
src/
  api/            Typed fetch client (api/client.ts) and shared API types
  context/        AuthContext — session state, wired to the auth WebSocket
  hooks/          useAuthSocket (realtime auth events), useFaceAnalyzer
                  (interview telemetry via face-api.js)
  components/     Shared UI: Sidebar, DashboardLayout, Toast, LoadingSpinner,
                  ImageCropModal, PageHeader, EmptyState, ProtectedRoute
  pages/          Route-level pages
    dashboard/    Everything behind auth: Home, Resumes, ResumeTailor,
                  AtsChecker, AiChatbot, ProjectRecommender, LiveInterview,
                  InterviewReport, Profile, Settings
  styles/         tokens.css, base.css, components.css, utilities.css,
                  auth.css, dashboard.css
```

Every dashboard and auth page is lazy-loaded (`React.lazy` in `App.tsx`), so
heavy dependencies — Monaco Editor and face-api.js on the Live Interview
page, react-markdown on the AI chat page — are only downloaded when a person
actually visits that page.

## Getting started

```bash
npm install
cp .env.example .env   # adjust VITE_API_BASE_URL if needed
npm run dev
```

The dev server proxies `/api` (both HTTP and WebSocket traffic) to
`http://127.0.0.1:8000`, so run the FastAPI backend locally alongside it.

```bash
npm run build     # type-check with tsc, then production build to dist/
npm run preview   # preview the production build locally
```

## Notes on a few implementation details

- **Face-api models** live in `public/models` and are loaded once per
  session by `useFaceAnalyzer`, which also computes blink count and an
  average "confidence" score from expression weights for the post-interview
  report.
- **The Live Interview page** uses the browser's native SpeechRecognition
  and SpeechSynthesis APIs (Chrome, Edge, and Safari support these; Firefox
  does not) alongside a raw WebSocket to `/api/interview/ws/chat` for the
  conversational loop.
- **Resume Tailor** offers three extraction engines (LaTeX, HTML/CSS, and a
  WYSIWYG visual editor) against the same `/api/tailor/*` endpoints, with an
  in-browser LaTeX-to-PDF compile step and a contenteditable iframe for the
  visual mode.
- **Theming** is a real, working system (not a placeholder) — see the
  "Themes" section above for how it's wired.
