# Project Documentation: AI Interview Coach

Last updated: 14 Oct 2026

## 1. Project Overview
The AI Interview Coach is a full-stack SaaS application for freshers entering the software development job market. It provides role-based mock interviews with AI-generated feedback, progress tracking and PDF reports, plus a deterministic ATS Resume Checker and a Resume Optimizer.

### Tech Stack
*   **Frontend:** React, Vite, Tailwind CSS v4, Zustand, Lucide Icons, Recharts, Framer Motion
*   **Backend:** Node.js, Express, Mongoose (MongoDB Atlas), Multer, pdf-parse, Puppeteer, Handlebars
*   **AI:** OpenRouter-compatible API served through a local gateway (free-tier providers). Models are routed by task:
    *   `gemini-3-flash` (non-reasoning): ATS extraction, ATS verification pass 1, resume summarization, topic planning, interview questions, final summary, optimized resume JSON
    *   `gemini-3.8-flash-high` (reasoning): ATS verification pass 2 only, for items pass 1 marks "unsure"
*   **Data/caching:** MongoDB collections for sessions, answers and `AtsCache` (extracted job requirements, keyed by hash)
*   **Deployment:** Netlify (frontend), Railway (backend)

---

## 2. Architecture & Design Decisions
A RESTful API connects the React frontend to an Express backend.

**Core design rule:** use AI only where judgement is needed (reading a job description, grading an answer, resolving an unsure match). Everything deterministic runs in code: parsing, normalization, matching, scoring, formatting checks and suggestions. This keeps scores repeatable, cheap and explainable.

### Data Flow
1.  **Authentication:** JWT-based stateless authentication.
2.  **Interview session:** created in MongoDB (`interview_sessions`). The uploaded resume is parsed with `pdf-parse`, cleaned of bracketed placeholders, and summarized once into a ~150-word profile (`resumeSummary`) plus 5 distinct interview topics (`plannedTopics`). Both are stored on the session and cached by SHA-1 hash of the resume text.
3.  **Question and feedback loop:** each question gets exactly one planned topic. Answers are scored per question with a calibrated rubric and stored in `questionanswers` with a short `topic` label.
4.  **Summary:** the final summary receives only question numbers, topic/question snippets, scores and gaps, never full answers.
5.  **ATS check:** the resume is parsed deterministically, the job description is turned into structured requirements by one cached AI call, matching and scoring happen in code, and an AI verifier is used only for requirements the code could not confirm.

### Model Routing and Token Caps
| Task | Function | Model class | Previous cap | Recommended cap | Observed completion |
|---|---|---|---|---|---|
| ATS requirement extraction | `checkResumeATS` | non-reasoning | 2,500 | 3,000 | about 1,000 |
| ATS verification (pass 1 / pass 2) | `checkResumeATS` | non-reasoning / reasoning | 400 | 1,500 (pass 2: 2,500) | 53 / 771 (before the split) |
| Resume bullet suggestions | `suggestResumeEdits` | non-reasoning | 1,200 | 2,000 | not logged |
| Resume summary + topics | `summarizeResume` | non-reasoning | 600 | 800 | 220 to 330 |
| First question | `generateFirstQuestion` | non-reasoning | 300 | 300 | 72 to 84 |
| Answer evaluation + next question | `evaluateAndNext` | non-reasoning | 800 | 800 | 250 to 380 |
| Final summary | `generateSummary` | non-reasoning | 1,500 | 1,500 | about 334 |
| Optimized resume JSON | `optimizeResumeToJSON` | non-reasoning | 4,000 | 4,000 | not logged |

Rules applied to all calls: check `finish_reason` and retry once with a larger cap if it is "length"; never parse truncated JSON; reasoning tokens count against the cap, so reasoning calls need roughly 2 to 3 times the normal cap.

---

## 3. Key Features & Enhancements

### A. ATS Checker: 6-phase, 21-step deterministic pipeline
**Phase A: Resume processing (no AI)**
*   Upload validation (PDF, 10 MB Multer limit, minimum readable text).
*   Format checks run on the raw text: email, phone, Experience / Education / Skills headings, garbage contact symbols (`ï`, `§`, `Ð`) and unfilled placeholders (`[Insert ...`).
*   Normalizer: strips bracketed placeholders, preserves symbols inside technical tokens (C++, C#, .NET, Node.js, CI/CD), maps `.js` variants, cleans whitespace.

**Phase B: Job description processing (one cached AI call)**
*   Boilerplate (company intro, benefits) removed, length capped, SHA-1 hash computed.
*   `AtsCache` stores the extracted requirements keyed by hash + model + prompt version, so repeat JDs cost 0 AI tokens and survive server restarts.
*   Structured tagging: each requirement has a type (skill, tool, certification, degree, years, soft_skill), required/preferred importance, synonyms and abbreviations (for example CI and Continuous Integration).
*   Code-side scan adds all-caps acronyms and bullet-list items the model skipped; duplicate short acronyms already covered by longer items are dropped.
*   `processRequirements` splits compounds only on space-padded slashes (` / `) and ` or `, producing any-of requirements ("JWT / OAuth 2.0", "Kafka or RabbitMQ"); CI/CD is kept intact.

**Phase C: Matching (deterministic, alias-enabled)**
*   Stemming (`stem`), `.js` normalization, proximity multi-word matching (`phraseIn`) and a confirmed-alias table.
*   `degreeMatch` checks degree level and field separately (for example "Computer Science degree" matches "B.Tech. Computer Science & Engineering"); degree requirements are never matched by generic synonyms, so "BSc in Nursing" fails on a software resume.

**Phase D: Miss verification (cheap, only when needed)**
*   Up to 8 unmatched required skills go to one compact batch call with the most relevant resume sentences, cached by resume + JD hash.
*   Pass 1 (non-reasoning) returns true, false or "unsure". Pass 2 (reasoning model) re-checks only "unsure" items.

**Phase E: Scoring and output**
*   Skills, tools, certifications and degrees are scored; required items weigh 2x; years and soft skills are informational.
*   Short or inferred job descriptions are capped at 85% with a low-confidence note; scores under 25% trigger the poor-fit rule, which suppresses irrelevant suggestions.
*   Suggestions are generated in code from the missing-keyword list (no extra LLM call).

**Phase F: Interview-side optimizations (see section C below) and the task-labelled token logging used to audit every AI call.**

### B. Resume Optimizer & PDF Export
*   Generates a clean, professional PDF resume through Puppeteer and Handlebars templates, preserving clickable links (`<a href="...">`) and distinct section styling.
*   10 MB upload limit via Multer and refresh-guard redirection.
*   `optimizeResumeToJSON` runs on the non-reasoning model.
*   **Safeguards still to add** (see section 7): rules that forbid inventing facts, a code check that rejects suggested bullets containing technologies absent from the original resume, and user-selected (not automatic) keyword hand-off.

### C. Interview Coach Quality and Token Optimization
*   **Resume summarization:** one call per resume at session start; cached by SHA-1 hash; bracketed placeholders removed first.
*   **Dedicated non-reasoning model** (`getInterviewModel()`): removed hidden reasoning tokens.
*   **Topic planning:** 5 distinct topics planned once and stored in `InterviewSession.plannedTopics`; each question uses one topic, and a short `topic` label is stored per answer.
*   **History compression:** later prompts receive short topic labels, not full question history; the final summary receives only snippets, scores and gaps.
*   **Calibrated rubric:** technical accuracy, depth and mechanics, production trade-offs; scores capped at 9/10; at least one concrete gap required per answer; `idealAnswerHint` must give factual guidance.
*   **Factual constraints:** prompts forbid assuming backend responsibility for projects the resume lists as frontend-only, and restrict Medium difficulty to practical implementation, API design and debugging.
*   **Output cleaning:** `cleanQuestion` strips "Welcome", "Thanks" and praise openers in code.
*   **Copied-answer guard:** answers that merely repeat the question, or are trivially short, are marked "not answered" instead of counting as a knowledge gap.
*   **Final-summary bug fix:** `max_tokens` raised from 400 to 1,000 after truncated JSON caused `JSON.parse` to fail and the results page to hang.
*   **Task-labelled usage logging:** every call logs model, prompt, completion and reasoning tokens.

---

## 4. Results and Measured Improvements
All figures come from terminal logs of 8-call, 5-question interviews on 14 Oct 2026 with the same 3,423-character resume. They are single runs, not averages, and token totals include hidden reasoning tokens.

### 4.1 Interview token usage per run
| Run | Configuration | Total tokens | Prompt | Completion | Reasoning |
|---|---|---|---|---|---|
| A | Resume summarization added, reasoning model | 20,223 | 7,818 | 12,405 | 10,044 |
| B | Rubric and topic labels added, model still reasoning | 24,117 | 9,117 | 15,000 | 12,446 |
| C | `gemini-3-flash` pinned | 10,214 | 7,954 | 2,260 | 0 |
| D | Final: topic planning, strict prompts | 10,946 | 8,682 | 2,264 | 0 |

**Change, final run D versus earlier runs**
| Metric | vs run A | vs run B |
|---|---|---|
| Total tokens | -45.9% (20,223 to 10,946) | -54.6% (24,117 to 10,946) |
| Completion tokens | -81.8% (12,405 to 2,264) | -84.9% (15,000 to 2,264) |
| Reasoning tokens | -100% (10,044 to 0) | -100% (12,446 to 0) |
| Prompt tokens | +11.1% (7,818 to 8,682) | -4.8% (9,117 to 8,682) |

The savings come almost entirely from removing hidden reasoning and shortening outputs. Prompt tokens rose slightly in run D because the topic plan, stricter rubric and factual constraints add instructions.

### 4.2 Per-call comparison (run B to run D)
| Call | Before | After | Change |
|---|---|---|---|
| Resume summary + topic plan | 3,628 | 1,547 | -57.4% |
| First question | 1,123 | 596 | -46.9% |
| Answer evaluation (average of 5) | 3,115 | 1,576 | -49.4% |
| Final summary | 3,793 | 923 | -75.7% |
| Final-summary prompt alone | 2,091 | 589 | -71.8% |

### 4.3 Resume context per call
The resume text sent with each call fell from 3,423 characters (cap 4,000) to a stored summary of 862 to 1,068 characters: **-68.8% to -74.8%** against the raw resume.

### 4.4 ATS checker
| Metric | Before (prompt-only scoring) | After (deterministic pipeline) |
|---|---|---|
| Score on identical input (title-only JD, same resume) | 95, 100, 73, 93, 98 (27-point spread) | Identical on repeated runs; capped at 85% with a low-confidence note |
| Invented "missing" requirements from a one-line JD | 8 in one run (Angular, Vue.js, GraphQL, NoSQL, Azure, Google Cloud Platform, Microservices, OAuth), 3 in another | 0; every requirement comes from the JD |
| Non-keywords listed as keywords | 2 ("Specific technical requirements...", "Industry-specific domain expertise") | 0 |
| Mismatched JD (nurse role vs software resume) | no guard | 9% then 8% then 0% across iterations; final 0% with poor-fit message |
| Irrelevant suggestions on the mismatched JD | 2 (add "EMR", "Patient Assessment" to a project) | 0 |
| Placeholder detection | none (95% score despite 2 unfilled placeholders) | detected and flagged |
| Deterministic format checks | 0 (model-guessed, never shown in the UI) | 7, shown in the UI |
| False misses fixed in testing | none handled | Frontend framework, Computer Science degree, REST API, Kubernetes, NoSQL |
| Verification call cost | 1,455 tokens (714 reasoning) | 744 tokens (0 reasoning): **-48.9%** |
| Verification completion tokens | 771 | 53: **-93.1%** |
| AI cost of a new JD (extraction + verification) | 2,885 | 2,174: **-24.6%** |
| AI cost of a repeated JD | 1 full call | 0 (cache hit): **-100%** |

### 4.5 Interview quality
| Metric | Before | After |
|---|---|---|
| Questions repeating a topic (one report) | 3 of 5 on streaming, 2 of 5 near-identical Flask questions | 5 of 5 distinct planned topics (0% repeat) |
| Filler openers ("Welcome", "Thanks") | 4 of 5 questions | 0 of 5 (name-prefix openers still appear in some questions) |
| Per-question score spread | 8.5 to 9.5 (all inflated) | 1 to 10 range across reports; capped at 9; every answer lists at least one gap |
| Average report score | 9.2 on one report of polished answers | 6.0, 6.4 and 7.4 on later reports (answers differed, so not a like-for-like comparison) |
| False knowledge gap from a pasted-question answer | scored 1/10 as a gap | marked "not answered" |
| Final-summary failures (truncated JSON) | results page hung | fixed by raising the cap from 400 to 1,000 |

### 4.6 Portfolio highlights
*   Cut AI token usage per mock interview by about 55% (24,117 to 10,946) and eliminated about 12,400 hidden reasoning tokens per interview by routing structured tasks to a non-reasoning model.
*   Replaced LLM-guessed ATS scoring with a deterministic keyword pipeline: identical results on repeated runs, versus a 27-point spread before.
*   Cut ATS verification cost by 49% through two-pass routing (fast model first, reasoning model only for unsure items), with repeat job descriptions costing 0 tokens through a MongoDB cache.
*   Reduced resume context per LLM call by about 70% through one-time summarization and hash caching.

---

## 5. Key API Endpoints
*   **POST** `/api/auth/signup` / `/login`: authentication
*   **GET** `/api/auth/me`: current user
*   **POST** `/api/resume/check`: deterministic ATS checker (10 MB limit)
*   **POST** `/api/resume/suggest-edits`: AI resume optimizer suggestions
*   **POST** `/api/resume/optimize-pdf`: download optimized resume PDF
*   **POST** `/api/interview/start`: creates the session, resume summary and 5 planned topics
*   **POST** `/api/interview/answer`: evaluates the answer, returns feedback and the next question
*   **DELETE** `/api/interview/session/:sessionId/abandon`: cleans up unfinished sessions
*   **GET** `/api/history`, `/api/history/:sessionId`: past sessions
*   **GET** `/api/dashboard/progress`, `/stats`, `/role-breakdown`: aggregated stats and chart data

---

## 6. Testing
*   `test_suite.js` covers the helper functions: tokenizer, proximity phrase matching and compound-requirement splitting.
*   Manual end-to-end tests run: repeat-run stability, mismatched JD (nurse), title-only JD, empty JD, MERN full-stack JD, backend JD with a second resume.
*   Interview runs logged with task labels and reviewed against the generated PDF reports.

---

## 7. Known Limitations and Next Steps
*   **Verify end to end** the compound-requirement fix ("JWT / OAuth 2.0" matched through JWT, Kubernetes in "Kubernetes and Terraform") with a full run; the unit tests do not cover the whole pipeline.
*   **Cross-restart stability:** confirm that scores stay within about 3 points after a server restart now that requirements are cached in MongoDB.
*   **Matched-keyword fragments:** duplicates such as AWS, CD, API and SQL listed beside longer items need a final check.
*   **Interview role accuracy:** the hackathon project can still be described as backend work in some questions; the planned-topic text must say "frontend only".
*   **Difficulty calibration:** Medium questions should stay within technologies the resume lists.
*   **Name-prefix openers** ("Mohit, ...") still need stripping in `cleanQuestion`.
*   **Title-only JD:** show "not enough detail to score" instead of a percentage when fewer than about 5 requirements are extracted.
*   **Optimizer safeguards:** no-invention rules, a code check against new technologies, and user-selected keywords; restore `suggestResumeEdits` if it is missing from `aiService.js`.
*   **Alias learning:** an "I have this" button that stores confirmed term/phrase pairs.
*   **Security and deployment:** generic error messages, no logging of resume text, PDF-only checks, and confirmation that the hosted backend cannot reach a paid model by accident.

---

## 8. Maintenance & Git Configuration
*   `.gitignore` files for backend and frontend exclude `node_modules`, `.env`, build artifacts (`dist`, `reports`), logs and IDE configuration files.