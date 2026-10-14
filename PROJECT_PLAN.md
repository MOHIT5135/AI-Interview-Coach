# AI Interview Coach — Major Portfolio Project Plan

## New Feature: ATS Checker & Resume Optimizer
We will add:
### 1. ATS Checker
- Frontend: `ATSCheckerPage` (upload resume + paste JD).
- Backend: `POST /api/resume/check` (compares resume to JD).
- AI: Prompt template to output JSON: `{ matchScore, missingKeywords[], formattingIssues[], suggestions[] }`.

### 2. Resume Optimizer
- Frontend: `ResumeOptimizerPage` (upload resume + target role).
- Backend: `POST /api/resume/optimize` (rewrites resume to better match target role/industry standards).
- AI: Prompt template to output optimized resume text.

## Context

Mohit is a fresher targeting software/web development jobs. He already has a RAG app (Ragify AI) deployed at ragifyy.netlify.app. The goal is to build a second, more impressive full-stack SaaS project that demonstrates: React frontend, Node.js backend, MongoDB, JWT auth, REST APIs, and AI integration via OpenRouter. The project should be live, demo-able, and visually polished for a resume/portfolio.

**Confirmed Stack:**
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: MongoDB Atlas (already set up)
- AI: OpenRouter API (existing key in openRouter_API_KEY.txt)
- Deploy: Netlify (frontend) + Railway (backend)

---

## Project: AI Interview Coach SaaS

Users select a job role and difficulty → AI conducts a mock interview question by question → scores each answer with feedback → generates a session summary report → dashboard tracks progress over time.

---

## Folder Structure

### Backend — `ai-interview-coach-backend/`
```
src/
├── config/
│   ├── db.js                  # MongoDB Atlas connection (Mongoose)
│   └── openrouter.js          # OpenRouter axios client config
├── controllers/
│   ├── authController.js      # signup, login, /me
│   ├── interviewController.js # startInterview, submitAnswer, endSession
│   ├── historyController.js   # list sessions, get one, delete
│   └── dashboardController.js # stats, progress chart data, role breakdown
├── middleware/
│   ├── authMiddleware.js      # JWT verify, attaches req.user
│   └── errorHandler.js        # global error handler
├── models/
│   ├── User.js
│   ├── InterviewSession.js
│   └── QuestionAnswer.js
├── routes/
│   ├── authRoutes.js
│   ├── interviewRoutes.js
│   ├── historyRoutes.js
│   └── dashboardRoutes.js
├── services/
│   ├── aiService.js           # all OpenRouter calls — the brain of the app
│   └── reportService.js       # pdfkit PDF generation
└── utils/
    ├── promptTemplates.js     # all LLM prompt strings (quality = output quality)
    └── jwtUtils.js
server.js                      # entry point
```

### Frontend — `ai-interview-coach-frontend/`
```
src/
├── api/
│   ├── axiosClient.js         # axios instance + JWT interceptor (everything depends on this)
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
│   ├── LandingPage.jsx        # public hero page, CTA
│   ├── LoginPage.jsx
│   ├── SignupPage.jsx
│   ├── DashboardPage.jsx      # stats + score chart + recent sessions
│   ├── InterviewSetupPage.jsx # role picker + difficulty selector
│   ├── InterviewPage.jsx      # CORE: question → answer → feedback loop (most complex)
│   ├── SessionSummaryPage.jsx # overall score, strengths/weaknesses, download PDF
│   └── HistoryPage.jsx        # past sessions, filterable
└── store/
    └── interviewStore.js      # Zustand: session state during active interview
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
  questionNumber, question, userAnswer,
  score (1-10), goodPoints: [String], missingPoints: [String], idealAnswerHint,
  timeToAnswer (seconds), createdAt
}
Indexes: sessionId, userId
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
| POST | `/start` | `{role, difficulty}` → creates session, returns first question |
| POST | `/answer` | `{sessionId, answer}` → scores answer, returns feedback + next question or done signal |
| POST | `/end` | `{sessionId}` → force end, triggers summary generation |
| GET | `/session/:sessionId` | Get current in-progress session state |

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

## OpenRouter AI Integration

**Model:** `mistralai/mistral-7b-instruct` (cheap, fast) — fallback: `openai/gpt-4o-mini`

**Base URL:** `https://openrouter.ai/api/v1`
**Headers:** `Authorization: Bearer <key>`, `HTTP-Referer: <app-url>`, `X-Title: AI Interview Coach`

### Three Prompt Templates (`promptTemplates.js`):

**1. Generate first question**
```
System: You are an expert technical interviewer for {role} positions. Difficulty: {difficulty}.
User: Ask question 1 of {totalQuestions}. Ask ONLY ONE question. No preamble. Just the question.
```

**2. Evaluate answer + get next question** (returns strict JSON)
```
System: You asked: "{previousQuestion}". Candidate answered: "{userAnswer}".
Output ONLY valid JSON: { score, goodPoints[], missingPoints[], idealAnswerHint, nextQuestion (null if last) }
```

**3. Generate session summary** (returns strict JSON)
```
System: Review this completed interview. Role: {role}. Difficulty: {difficulty}.
Q&A pairs with scores: {formattedQAPairs}
Output ONLY valid JSON: { overallScore, strengths[], weaknesses[], summary }
```

**Key functions in `aiService.js`:**
- `generateFirstQuestion(role, difficulty, totalQuestions)`
- `evaluateAndNext(role, difficulty, prevQuestion, userAnswer, questionNum, totalQuestions)`
- `generateSummary(role, difficulty, qaPairs)`

Include a robust JSON parser that handles markdown-wrapped responses from the model.

---

## Phased Build Order

### Phase 1 — Backend Foundation (Days 1–3)
Goal: Full interview flow testable in Postman before touching frontend.

1. Init Express project. Install: `express mongoose bcryptjs jsonwebtoken cors dotenv`
2. Write `db.js` → connect to MongoDB Atlas
3. Create `User` model → write auth controller (signup + login with bcrypt + JWT)
4. Write `authMiddleware.js`
5. Create `InterviewSession` + `QuestionAnswer` models
6. Write `aiService.js` — `generateFirstQuestion` + `evaluateAndNext`
7. Write `promptTemplates.js` — all three prompt strings
8. Write interview controller: `startInterview` + `submitAnswer`
9. Test all endpoints in Postman

### Phase 2 — Frontend Core (Days 4–7)
Goal: User can sign in and complete a full interview end-to-end.

1. Scaffold Vite + React. Install: `axios react-router-dom zustand tailwindcss react-hot-toast react-hook-form`
2. Write `axiosClient.js` (JWT interceptor + base URL from `VITE_API_URL`)
3. Build `AuthContext.jsx` + `useAuth` hook
4. Build Login + Signup pages
5. Build `ProtectedRoute`
6. Build `InterviewSetupPage` (role cards + difficulty radio)
7. Build `InterviewPage` — THE KEY COMPONENT:
   - Progress bar (Question X of Y)
   - Question display with typewriter effect
   - Answer textarea + Submit button with loading state
   - FeedbackPanel (score badge, good points, missing points, ideal hint)
   - Next Question → repeat
8. Build `SessionSummaryPage` (overall score, strengths/weaknesses, AI summary text)

### Phase 3 — History, Dashboard, Report (Days 8–11)
Goal: Full feature set.

1. Backend: History routes + dashboard stats/progress endpoints
2. Backend: Wire `generateSummary` into `submitAnswer` when last question answered
3. Frontend: `DashboardPage` — stat cards + Recharts line chart (`ScoreChart`)
4. Frontend: `HistoryPage` — session list + detail modal
5. Backend: PDF report with `pdfkit` (session Q&A + scores + summary)
6. Frontend: "Download Report" button hitting `/api/dashboard/report/:sessionId`

### Phase 4 — Polish + Deploy (Days 12–14)
Goal: Live, shareable, portfolio-ready.

1. Tailwind responsive layout pass (mobile + desktop)
2. Loading skeletons, error boundaries, toast notifications
3. Typewriter animation on questions, score badge reveal animation
4. Deploy backend to Railway (set env vars: MONGO_URI, JWT_SECRET, OPENROUTER_API_KEY, FRONTEND_URL)
5. Deploy frontend to Netlify (set `VITE_API_URL`, add `public/_redirects` with `/* /index.html 200`)
6. End-to-end smoke test on live URLs
7. Record 2-min demo video for portfolio/resume

---

## Key Dependencies

| Purpose | Package |
|---------|---------|
| State management | Zustand |
| Charts | Recharts |
| Styling | Tailwind CSS |
| PDF generation | pdfkit (backend) |
| Notifications | react-hot-toast |
| Forms | react-hook-form |
| HTTP client | Axios |

---

## Architecture Flow
```
Browser → Netlify CDN (React SPA)
              ↓ REST + JWT
         Railway (Express)
           ↓           ↓
     MongoDB Atlas   OpenRouter API
                    (Mistral / GPT-4o-mini)
```

---

## Critical Files (implement with care)
- `src/services/aiService.js` — all OpenRouter calls, JSON parsing, prompt injection
- `src/controllers/interviewController.js` — session lifecycle logic
- `src/utils/promptTemplates.js` — prompt quality = output quality
- `InterviewPage.jsx` — most complex, most demo-worthy frontend component
- `axiosClient.js` — JWT interceptor; everything frontend depends on this

---

## Verification / Testing
1. Postman: test all 3 interview API steps (start → answer × N → summary) before frontend
2. React DevTools: verify Zustand session state updates correctly during interview
3. JWT: test ProtectedRoute redirects when token missing/expired
4. PDF: download and open report on live deployment
5. Recharts: verify progress chart reflects multiple completed sessions
6. Mobile: test on 375px viewport (iPhone SE) — key for recruiter impressions
