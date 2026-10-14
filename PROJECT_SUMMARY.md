# Project Documentation: AI Interview Coach

## 1. Project Overview
The AI Interview Coach is a full-stack SaaS application designed for freshers entering the software development job market. It provides a platform for tailored, role-based mock interviews with AI-generated feedback, tracking progress, and performance reporting, alongside an advanced ATS Resume Checker and Optimizer.

### Tech Stack
*   **Frontend:** React, Vite, Tailwind CSS v4, Zustand, Lucide Icons, Recharts, Framer Motion
*   **Backend:** Node.js, Express, Mongoose (MongoDB Atlas), Multer, Puppeteer, Handlebars
*   **AI:** OpenRouter API (local hosted proxy support), GPT-4o-mini / Mistral models
*   **Deployment:** Netlify (Frontend), Railway (Backend)

---

## 2. Architecture & Design Decisions
The application uses a standard RESTful API architecture connecting the React frontend to an Express backend. 

### Data Flow
1.  **Authentication:** JWT-based stateless authentication.
2.  **Interview Session:** A session is created in MongoDB (`interview_sessions`). Uploaded resumes are parsed via `pdf-parse` and summarized into a concise ~150-word technical profile (`resumeSummary`) for efficient prompt usage.
3.  **Question & Feedback Loop:** Q&A pairs are stored in `questionanswers`, linked to the session and user.
4.  **Scoring & Summary:** Evaluation happens per question based on a structured rubric (0–10 scale). Upon session completion, a summary document is generated.

---

## 3. Key Features & Recent Enhancements

### A. Deterministic ATS Checker & Optimizer
*   **Deterministic Matching:** Extracted keywords are matched against resume tokens using stemming (`stem`), normalization (`.js` handling), and phrase matching (`phraseIn`) in code rather than relying solely on erratic LLM scoring.
*   **Degree False Miss Handling (`degreeMatch`):** Intelligent matching of academic requirements against degree variants (e.g., matching "Computer Science degree" with "B.Tech. Computer Science & Engineering").
*   **Poor-Fit Rule:** Automatically detects misaligned job descriptions (match score under 25%) and suppresses irrelevant suggestions (e.g., medical/EMR keywords on a software engineering resume).
*   **Formatting & Placeholder Validation:** Scans uploaded resumes for unfilled placeholder text (`[Insert...`) and contact line garbage characters (`ï`, `§`, `Ð`).
*   **Resume Optimizer & PDF Export:** Generates clean, professional PDF resumes via Puppeteer and Handlebars templates, preserving clickable links (`<a href="...">`) and distinct section styling. Includes a 10MB upload limit via Multer and refresh-guard redirection.

### B. Interview Coach Token Optimization
*   **Resume Summarization:** Condenses uploaded resumes once at interview start into a ~150-word technical profile (`resumeSummary`) and caches it via SHA-1 hashing to eliminate redundant LLM calls.
*   **Prompt Payload Reduction:** Subsequent question generation and answer evaluations use the concise `resumeSummary` instead of raw 4,000-character resume texts, reducing prompt token consumption by ~80-90%.
*   **Token Usage Logging:** Automatically logs `response.data.usage` (`prompt_tokens`, `completion_tokens`, `total_tokens`) for every OpenRouter API call.

---

## 4. Key API Endpoints
*   **POST** `/api/auth/signup` / `/login` — Authentication
*   **POST** `/api/resume/check` — Deterministic ATS checker (10MB limit)
*   **POST** `/api/resume/suggest-edits` — AI resume optimizer suggestions
*   **POST** `/api/resume/optimize-pdf` — Download optimized resume PDF
*   **POST** `/api/interview/start` — Initializes interview session with resume summary
*   **POST** `/api/interview/answer` — Evaluates answer, provides feedback & next question
*   **DELETE** `/api/interview/session/:sessionId/abandon` — Cleans up unfinished sessions
*   **GET** `/api/dashboard/progress` — Aggregated stats and progress chart data

---

## 5. Maintenance & Git Configuration
*   `.gitignore` files configured for both backend and frontend to exclude `node_modules`, `.env`, build artifacts (`dist`, `reports`), logs, and IDE configuration files.
