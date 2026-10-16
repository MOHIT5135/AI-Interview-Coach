# AI Interview Coach — Major Portfolio Project Plan

Last updated: 14 Oct 2026 (status: core features implemented; optimization phase completed; hardening in progress)

## Feature Set: ATS Checker & Resume Optimizer (implemented)
### 1. ATS Checker
- Frontend: `ATSCheckerPage` (upload resume + paste JD). Shows match score, confidence note, matched keywords, missing keywords, formatting issues and suggestions.
- Backend: `POST /api/resume/check` (10 MB upload limit).
- Design: a 6-phase, 21-step deterministic pipeline. AI is used for two things only: turning the job description into structured requirements (one cached call) and verifying requirements the code could not confirm (two-pass: fast model first, reasoning model only for "unsure" items). Parsing, normalization, matching, scoring, format checks and suggestions all run in code.
- Output: `{ matchScore, confidence, note, matchedKeywords[], missingKeywords[], formattingIssues[], suggestions[] }`.

### 2. Resume Optimizer
- Frontend: `ResumeOptimizerPage` (resume + target role, ticks which missing keywords to use).
- Backend: `POST /api/resume/suggest-edits` (bullet-level suggestions) and `POST /api/resume/optimize-pdf` (Puppeteer + Handlebars PDF with clickable links).
- Status: working; safeguards against invented content are still to be added (see Remaining Work).

## Context

Mohit is a fresher targeting software/web development jobs. He already has a RAG app (Ragify AI) deployed at ragifyy.netlify.app. The goal is to build a second, more impressive full-stack SaaS project that demonstrates: React frontend, Node.js backend, MongoDB, JWT auth, REST APIs, and AI integration. The project should be live, demo-able, visually polished, and measurably efficient (token usage, repeatable scoring).

**Confirmed Stack:**
- Frontend: React + Vite + Tailwind CSS v4 + Zustand + Recharts + Framer Motion
- Backend: Node.js + Express + Mongoose + Multer + pdf-parse + Puppeteer + Handlebars
- Database: MongoDB Atlas (sessions, answers, `AtsCache`)
- AI: OpenRouter-compatible API through a local gateway on free-tier providers; models routed per task (`gemini-3-flash` for structured work, `gemini-3.8-flash-high` for reasoning fallback only)
- Deploy: Netlify (frontend) + Railway (backend)

---

## Project: AI Interview Coach SaaS

Users select a job role and difficulty (and optionally upload a resume) → AI conducts a mock interview question by question, each on a planned topic → scores each answer with feedback → generates a session summary report → dashboard tracks progress over time. A separate ATS checker and resume optimizer help prepare the resume itself.

---

## Folder Structure

### Backend — `ai-interview-coach-backend/`
```
src/
├── config/
│   ├── db.js                  # MongoDB Atlas connection (Mongoose)
│   └── openrouter.js          # OpenRouter-compatible axios client config
├── controllers/
│   ├── authController.js      # signup, login, /me
│   ├── interviewController.js # startInterview (summary + topic plan), submitAnswer, abandon
│   ├── historyController.js   # list sessions, get one, delete
│   ├── dashboardController.js # stats, progress chart data, role breakdown
│   └── resumeController.js    # checkATS, suggestEdits, optimize PDF
├── middleware/
│   ├── authMiddleware.js      # JWT verify, attaches req.user
│   └── errorHandler.js        # global error handler
├── models/
│   ├── User.js
│   ├── InterviewSession.js    # + resumeSummary, plannedTopics
│   ├── QuestionAnswer.js      # + topic
│   └── AtsCache.js            # extracted JD requirements, keyed by hash + model + prompt version
├── routes/
│   ├── authRoutes.js
│   ├── interviewRoutes.js
│   ├── historyRoutes.js
│   ├── dashboardRoutes.js
│   └── resumeRoutes.js        # multer upload, auth-protected
├── services/
│   ├── aiService.js           # all AI calls, ATS pipeline, token-usage logging
│   ├── puppeteerService.js    # resume PDF rendering (Handlebars templates)
│   └── reportService.js       # interview report PDF generation
└── utils/
    ├── promptTemplates.js     # prompt strings (quality = output quality)
    ├── pdfUtils.js            # PDF parsing and text cleaning
    └── jwtUtils.js
test_suite.js                  # tokenizer, proximity matching, compound-splitting tests
server.js                      # entry point
```

### Frontend — `ai-interview-coach-frontend/`
```
src/
├── api/
│   ├── axiosClient.js         # axios instance + JWT interceptor
│   ├── authApi.js
│   ├── interviewApi.js
│   ├── historyApi.js
│   └── dashboardApi.js
├── components/
│   ├── common/                # Navbar, ProtectedRoute, LoadingSpinner, ScoreBadge
│   ├── interview/             # RoleSelector, DifficultySelector, QuestionCard, AnswerInput, FeedbackPanel, ProgressBar
│   ├── dashboard/             # ScoreChart (Recharts), StatCard, RoleBreakdown
│   └── history/               # SessionCard, SessionDetail
├── context/
│   └── AuthContext.jsx        # global auth state + useAuth hook
├── hooks/
│   └── useInterview.js        # interview session logic hook
├── pages/
│   ├── LandingPage.jsx
│   ├── LoginPage.jsx
│   ├── SignupPage.jsx
│   ├── DashboardPage.jsx      # stats + score chart + recent sessions
│   ├── InterviewSetupPage.jsx # role picker + difficulty selector + resume upload
│   ├── InterviewPage.jsx      # CORE: question → answer → feedback loop
│   ├── SessionSummaryPage.jsx # overall score, strengths/weaknesses, download PDF
│   ├── HistoryPage.jsx        # past sessions, filterable
│   ├── ATSCheckerPage.jsx     # resume + JD → score, keywords, format issues
│   └── ResumeOptimizerPage.jsx
└── store/
    ├── interviewStore.js      # Zustand: session state during active interview
    └── resumeStore.js         # Zustand: ATS findings and selected keywords
```

---

## Database Schema (MongoDB Atlas)

### `users`
```
{ _id, name, email (unique), passwordHash, createdAt, updatedAt }
```

### `interview_sessions`
```
{
  _id, userId (ref), role, difficulty,
  status: "in_progress" | "completed",
  totalQuestions, questionsAnswered,
  resumeSummary (about 150 words, placeholders stripped),
  plannedTopics: [String]   (5 distinct topics planned once),
  overallScore (null until complete),
  strengths: [String], weaknesses: [String], summary: String,
  startedAt, completedAt, createdAt
}
Indexes: userId, (userId + status)
```

### `question_answers`
```
{
  _id, sessionId (ref), userId (ref),
  questionNumber, topic (short label), question, userAnswer,
  score (1-9, capped), goodPoints: [String], missingPoints: [String] (at least one), idealAnswerHint,
  answered: Boolean (false for pasted-question or trivially short answers),
  timeToAnswer (seconds), createdAt
}
Indexes: sessionId, userId
```

### `ats_cache`
```
{ key (sha1 of cleaned JD + model + prompt version), data (structured requirements), createdAt }
Index: key (unique)
```

---

## REST API Endpoints

### `/api/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/signup` | Register → returns JWT |
| POST | `/login` | Login → returns JWT |
| GET | `/me` | Get current user (JWT required) |

### `/api/interview`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/start` | `{role, difficulty, resume?}` → creates session, resume summary and topic plan, returns first question |
| POST | `/answer` | `{sessionId, answer}` → scores answer, returns feedback + next question or done signal |
| POST | `/end` | `{sessionId}` → force end, triggers summary generation |
| GET | `/session/:sessionId` | Get current in-progress session state |
| DELETE | `/session/:sessionId/abandon` | Clean up an unfinished session |

### `/api/resume`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/check` | Resume PDF + JD → deterministic ATS result (10 MB limit) |
| POST | `/suggest-edits` | Resume PDF + target role + ATS findings → bullet suggestions |
| POST | `/optimize-pdf` | Optimized resume data → downloadable PDF |

### `/api/history`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List completed sessions (paginated) |
| GET | `/:sessionId` | Full session with all Q&A |
| DELETE | `/:sessionId` | Delete a session |

### `/api/dashboard`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Total sessions, avg score, best role, total time |
| GET | `/progress` | `[{date, score, role}]` for line chart |
| GET | `/role-breakdown` | Avg score per role |
| GET | `/report/:sessionId` | Download PDF (binary) |

---

## AI Integration

**Gateway:** OpenRouter-compatible endpoint (local gateway, free-tier providers). Base URL and model names come from environment variables; no paid key is needed or sent.

**Model routing by task**
| Task | Function | Model class | Token cap (previous → recommended) |
|---|---|---|---|
| ATS requirement extraction | `checkResumeATS` | non-reasoning | 2,500 → 3,000 |
| ATS verification pass 1 / pass 2 | `checkResumeATS` | non-reasoning / reasoning (unsure items only) | 400 → 1,500 (pass 2: 2,500) |
| Resume bullet suggestions | `suggestResumeEdits` | non-reasoning | 1,200 → 2,000 |
| Resume summary + 5 topics | `summarizeResume` | non-reasoning | 600 → 800 |
| First question | `generateFirstQuestion` | non-reasoning | 300 → 300 |
| Answer evaluation + next question | `evaluateAndNext` | non-reasoning | 800 → 800 |
| Final summary | `generateSummary` | non-reasoning | 1,500 → 1,500 |
| Optimized resume JSON | `optimizeResumeToJSON` | non-reasoning | 4,000 → 4,000 |

**Prompt design rules**
- Interview questions: one planned topic per question, no greeting or praise, no assumed backend role for frontend-only projects, Medium difficulty limited to practical implementation, API design and debugging.
- Answer evaluation: rubric of technical accuracy, depth and mechanics, production trade-offs; capped at 9/10; at least one concrete gap; `idealAnswerHint` must be factual guidance, not praise; copied or trivially short answers are marked "not answered".
- ATS extraction: atomic requirements with type, importance, synonyms and abbreviations; compounds use " / " or " or " for any-of items; never return sentences about the JD.
- Structured JSON only; every call checks `finish_reason` and retries once with a larger cap if the output was cut off.
- Every call logs model, prompt, completion and reasoning tokens with a task label.

**Key functions in `aiService.js`:** `summarizeResume`, `generateFirstQuestion`, `evaluateAndNext`, `generateSummary`, `checkResumeATS` (with `processRequirements`, `degreeMatch`, `phraseIn`, `stem`, `stripPlaceholders`, `formatChecks`), `suggestResumeEdits`, `optimizeResumeToJSON`, `cleanQuestion`, `callOpenRouter` (usage logging, robust JSON parser for markdown-wrapped output).

---

## Phased Build Order

### Phase 1 — Backend Foundation (Days 1–3): done
Express project, MongoDB connection, auth (bcrypt + JWT), session and answer models, `aiService`, interview controller, endpoint tests in Postman.

### Phase 2 — Frontend Core (Days 4–7): done
Vite + React scaffold, axios client with JWT interceptor, auth context and pages, protected routes, interview setup, `InterviewPage` loop, session summary.

### Phase 3 — History, Dashboard, Report (Days 8–11): done
History and dashboard endpoints, Recharts progress chart, history page, PDF interview report.

### Phase 4 — Polish + Deploy (Days 12–14): confirm live status
Responsive layout, loading states, error boundaries, deployment to Railway and Netlify with environment variables, smoke test on live URLs, demo video.

### Phase 5 — ATS, Optimizer and Optimization (completed 14 Oct 2026)
1. ATS Checker with the 6-phase deterministic pipeline, `AtsCache` persistence, degree matching, poor-fit rule, placeholder and symbol checks, code-generated suggestions.
2. Resume Optimizer with Puppeteer/Handlebars PDF export and an upload limit of 10 MB.
3. Interview token optimization: resume summarization with hash cache, non-reasoning model pinning, topic planning, history compression, summary payload reduction.
4. Interview quality: calibrated rubric (cap 9/10, mandatory gap), opener cleaning, copied-answer guard, factual constraints.
5. Reliability: final-summary `max_tokens` raised from 400 to 1,000 (fixed a truncated-JSON hang), task-labelled token logging.

### Phase 6 — Hardening (in progress): see Remaining Work

---

## Key Dependencies

| Purpose | Package |
|---------|---------|
| State management | Zustand |
| Charts | Recharts |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| PDF parsing | pdf-parse |
| PDF generation | Puppeteer + Handlebars (resume), pdfkit/Puppeteer (reports) |
| Uploads | Multer |
| Notifications | react-hot-toast |
| Forms | react-hook-form |
| HTTP client | Axios |

---

## Architecture Flow
```
Browser → Netlify CDN (React SPA)
              ↓ REST + JWT
         Railway (Express)
           ↓        ↓            ↓
   MongoDB Atlas   Gateway (OpenRouter-compatible)   Puppeteer (PDF)
   (sessions,      ├─ non-reasoning model: structured tasks
    answers,       └─ reasoning model: unsure-item verification only
    AtsCache)
```

ATS flow: PDF → parse and clean → format checks → normalize → job description cleaned and hashed → cache lookup → (miss) one extraction call → code matching and scoring → (only if unmatched required items) verification pass 1 → pass 2 for "unsure" → score, confidence, matched, missing, suggestions.

---

## Critical Files (implement with care)
- `src/services/aiService.js`: all AI calls, ATS pipeline, JSON parsing, usage logging
- `src/controllers/interviewController.js`: session lifecycle, resume summary and topic planning
- `src/controllers/resumeController.js`: upload validation and ATS endpoints
- `src/utils/promptTemplates.js`: prompt quality = output quality
- `InterviewPage.jsx`: most complex frontend component
- `axiosClient.js`: JWT interceptor; everything frontend depends on this

---

## Measured Results (14 Oct 2026)
Figures come from terminal logs of 8-call, 5-question interviews with the same 3,423-character resume and from repeated ATS runs. They are single runs, and token totals include hidden reasoning tokens. Full tables are in `PROJECT_SUMMARY.md`.

| Area | Before | After | Change |
|---|---|---|---|
| Interview tokens, total | 20,223 (run A) / 24,117 (run B) | 10,946 | -45.9% / -54.6% |
| Interview reasoning tokens | 10,044 / 12,446 | 0 | -100% |
| Interview completion tokens | 12,405 / 15,000 | 2,264 | -81.8% / -84.9% |
| Resume summary + topic call | 3,628 | 1,547 | -57.4% |
| Answer evaluation call (avg) | 3,115 | 1,576 | -49.4% |
| Final summary call | 3,793 | 923 | -75.7% |
| Resume context per call | 3,423 chars | 862 to 1,068 chars | -68.8% to -74.8% |
| ATS verification call | 1,455 tokens | 744 tokens | -48.9% |
| ATS new-JD AI cost | 2,885 tokens | 2,174 tokens | -24.6% |
| ATS repeated-JD AI cost | 1 full call | 0 (cache) | -100% |
| ATS score spread, identical input | 73 to 100 (27 points) | identical on repeat runs | spread removed |
| Invented requirements, one-line JD | 8 | 0 | -100% |
| Topic repeats in one interview | 3 of 5 on one topic | 0 of 5 | -100% |
| Filler openers | 4 of 5 questions | 0 of 5 | -100% |

---

## Verification / Testing
1. Postman: start → answer × N → summary flow (done).
2. React DevTools: Zustand session state during an interview (done).
3. JWT: ProtectedRoute redirects when token is missing or expired (done).
4. PDF: interview report and optimized resume download (done locally; re-check on live deployment).
5. Recharts: progress chart across multiple completed sessions.
6. Mobile: 375 px viewport check.
7. ATS test matrix: repeat run (pass), mismatched JD (pass, 0%), title-only JD (pass, capped at 85%), empty JD (pass), MERN full-stack JD (pass after degree and compound fixes), backend JD with second resume (pass with known fragments), resume pasted as JD (pending), restart stability (pending), compound-requirement end-to-end re-run (pending).
8. Interview test matrix: token log per run (pass), distinct topics (pass), no filler (pass), no backend role leakage for frontend-only projects (pending), difficulty calibration (pending).

---

## Remaining Work
- **ATS:** end-to-end re-run of the compound-requirement fix; remove matched-keyword fragments; "not enough detail to score" for title-only JDs; cross-restart stability check; "I have this" alias-learning button.
- **Optimizer:** forbid invented facts (placeholders and "e.g." text stay blank), reject suggested bullets that add technologies absent from the resume, limit repeated keywords, user-selected keyword hand-off, confirm `suggestResumeEdits` is exported.
- **Interview:** strip name-prefix openers, enforce frontend-only wording for the hackathon topic, keep Medium within the resume's technologies.
- **Security and deployment:** generic error messages, no logging of resume text, PDF-only upload check, confirm the hosted backend cannot call a paid model by accident, confirm live status of Netlify and Railway deployments.