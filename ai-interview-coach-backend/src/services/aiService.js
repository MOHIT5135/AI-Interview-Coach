const axios = require('axios');
const crypto = require('crypto');
const AtsCache = require('../models/AtsCache');
const AtsAlias = require('../models/AtsAlias');

const getModel = () => process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
const getInterviewModel = () => process.env.INTERVIEW_MODEL || process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
const getReasoningModel = () => process.env.REASONING_MODEL || 'google/gemini-2.0-flash-001';

const getBaseUrl = () => {
  let url = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  if (url.endsWith('/')) url = url.slice(0, -1);
  return url;
};

const callOpenRouter = async (prompt, temperature = 0, model = getModel(), taskName = 'AI Task') => {
  try {
    const headers = {
      'HTTP-Referer': 'https://ai-interview-coach.local',
      'X-Title': 'AI Interview Coach',
      'Content-Type': 'application/json',
    };

    if (process.env.OPENROUTER_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
    }

    const payload = {
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: temperature,
    };

    const response = await axios.post(`${getBaseUrl()}/chat/completions`, payload, { headers });
    const reportedModel = response.data.model || model;
    const usage = response.data.usage;
    const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens ?? 0;
    if (usage) {
      console.log(`[AI Usage] [${taskName}] Model: ${reportedModel} | Prompt: ${usage.prompt_tokens} | Completion: ${usage.completion_tokens} (Reasoning: ${reasoningTokens}) | Total: ${usage.total_tokens}`);
    }

    let text = response.data.choices[0].message.content.trim();
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      text = text.slice(1, -1).trim();
    }
    return text;
  } catch (error) {
    console.error('AI Service Error:', error.response?.data || error.message);
    throw new Error('Failed to communicate with AI service.');
  }
};

const parseJSON = (content, fallback = {}) => {
  try {
    let cleaned = String(content || '').replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIdx = 0;
    if (firstBrace !== -1 && firstBracket !== -1) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
    }

    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    let endIdx = cleaned.length;
    if (lastBrace !== -1 && lastBracket !== -1) {
      endIdx = Math.max(lastBrace, lastBracket) + 1;
    } else if (lastBrace !== -1) {
      endIdx = lastBrace + 1;
    } else if (lastBracket !== -1) {
      endIdx = lastBracket + 1;
    }

    if (startIdx < endIdx) {
      cleaned = cleaned.substring(startIdx, endIdx);
    }

    try {
      return JSON.parse(cleaned);
    } catch (parseErr) {
      let repaired = cleaned.trim().replace(/,\s*$/, '');
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      const openBrackets = (repaired.match(/\]/g) || []).length; 
      const closeBrackets = (repaired.match(/\]/g) || []).length;

      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

      return JSON.parse(repaired);
    }
  } catch (e) {
    console.error('Failed to parse JSON from AI response:', content);
    return fallback;
  }
};

const stripPlaceholders = (text) => {
  return String(text || '')
    .replace(/\[\s*insert[^\]]*\]/gi, '')
    .replace(/\[\s*enter[^\]]*\]/gi, '');
};

const cleanQuestion = (text) => {
  return String(text || '')
    .replace(/^(hi|hello|welcome|thanks|thank you|great answer|good job|moving on|next)[^.!?]*[.!?]\s*/gi, '')
    .replace(/^(dear|candidate)\s+[^,.!?]*[,.]?\s*/gi, '')
    .trim();
};

const getDefaultTopicsForRole = (role) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized.includes('software')) {
    return [
      'Data Structures & Algorithms',
      'Object-Oriented Design & Principles',
      'System Architecture & Concurrency',
      'Database Design & Query Optimization',
      'Code Quality, Testing & Debugging'
    ];
  }
  if (normalized.includes('frontend')) {
    return [
      'HTML/CSS & JavaScript/TypeScript Core',
      'UI Component Architecture & State Management',
      'Asynchronous API Integration & Data Fetching',
      'Frontend Performance Optimization',
      'Cross-Browser Compatibility & Testing'
    ];
  }
  if (normalized.includes('backend')) {
    return [
      'RESTful APIs & Microservices Architecture',
      'Database Modeling, Indexing & Transactions',
      'Authentication, Authorization & Security',
      'Caching, Message Queues & Async Processing',
      'Scalability, Concurrency & Error Handling'
    ];
  }
  if (normalized.includes('full stack')) {
    return [
      'End-to-End System Architecture & API Design',
      'Frontend State Management & UI Responsiveness',
      'Backend Service Architecture & Business Logic',
      'Database Schemas & Data Integrity',
      'Deployment, DevOps Integration & System Reliability'
    ];
  }
  if (normalized.includes('data')) {
    return [
      'Exploratory Data Analysis & Statistics',
      'Machine Learning Modeling & Evaluation',
      'Feature Engineering & Data Preprocessing',
      'Deep Learning & Model Optimization',
      'Model Deployment, Monitoring & Pipeline Design'
    ];
  }
  if (normalized.includes('devops')) {
    return [
      'Containerization & Docker Fundamentals',
      'CI/CD Pipelines & Build Automation',
      'Kubernetes & Container Orchestration',
      'Infrastructure as Code (Terraform) & Cloud',
      'Observability, Monitoring, Logging & Incident Management'
    ];
  }
  if (normalized.includes('system design')) {
    return [
      'High-Level Architecture & Microservices Decomposition',
      'Scalability, Load Balancing & Partitioning',
      'Caching Strategies & Content Delivery Networks (CDNs)',
      'Database Selection, Replication, Consistency & Sharding',
      'Fault Tolerance, Resiliency & Rate Limiting'
    ];
  }
  return [
    'Core Engineering Fundamentals',
    'System Architecture & Problem Solving',
    'Data Management & Storage',
    'Performance Optimization & Scalability',
    'Testing, Reliability & Code Quality'
  ];
};

const getDifficultyGuidelines = (difficulty) => {
  const level = String(difficulty || '').toLowerCase().trim();

  if (level === 'easy') {
    return `DIFFICULTY RULES - EASY (Basic to Intermediate-Easy Concepts):
- QUESTION STYLE (CRITICAL - DO NOT OVERWHELM):
  * Ask EXACTLY ONE single, focused technical question (maximum 2-3 sentences).
  * STRICT PROHIBITION: DO NOT ask compound questions, do NOT use numbered lists (no "1. ..., 2. ..."), and do NOT combine multiple separate topics in one prompt.
  * Keep the question approachable, direct, and conversational.
- QUESTION SCOPE:
  * Core language syntax, variables, primitive types, control flow, functions, basic data structures (arrays, strings, basic hash maps, singly linked lists).
  * Foundational OOP principles (encapsulation, inheritance, polymorphism), standard HTTP methods (GET vs POST), basic status codes.
- SCORING & EVALUATION FAIRNESS:
  * Grade on basic conceptual understanding and clear everyday explanation.
  * If the candidate explains the foundational concept accurately in their own words, award 9/10 or 10/10.
  * DO NOT penalize for omitting production-grade architecture, microservices, multithreading, or edge cases.
  * If the answer accurately covers the basic concept, "missingPoints" should be empty ([]).`;
  }

  if (level === 'medium') {
    return `DIFFICULTY RULES - MEDIUM (Intermediate-Medium to Fundamental Concepts / Vital Core Concepts):
- QUESTION STYLE (CRITICAL - DO NOT OVERWHELM):
  * Ask EXACTLY ONE cohesive practical feature or architectural scenario (maximum 2-3 sentences).
  * STRICT PROHIBITION: DO NOT bundle 3-4 separate engineering domains into one question (e.g., DO NOT ask about Docker + CORS + Netlify + Render all in one question). Pick ONE focused engineering challenge.
  * Do NOT use numbered lists or multi-part sub-questions.
- QUESTION SCOPE:
  * Non-linear data structures (trees, graphs BFS/DFS), core algorithms, concurrency basics (async/await, promises, event loop).
  * Database fundamentals (indexing, ACID, normalization vs denormalization), clean REST API design, state flow, practical debugging.
- SCORING & EVALUATION FAIRNESS:
  * Grade on whether the candidate explains the practical implementation flow, mechanism, and the "why" behind their technical approach.
  * A clear, structured answer covering the core mechanism MUST receive 8.5/10 to 10/10.
  * STRICT PROHIBITION: DO NOT penalize for omitting low-level library internal variable names (e.g., '_retry', 'isRefreshing'), C++ vector index constants (e.g., 'hnsw:M'), or niche platform deployment quirks (e.g., Linux PID 1 signal forwarding).
  * If the candidate's explanation is sound and covers the necessary practical steps, "missingPoints" should be empty ([]).`;
  }

  if (level === 'hard') {
    return `DIFFICULTY RULES - HARD (Intermediate-Hard to Advanced Concepts):
- QUESTION STYLE (CRITICAL - DO NOT OVERWHELM):
  * Ask EXACTLY ONE deep, targeted production challenge or architectural trade-off (maximum 2-3 sentences).
  * Keep the problem crisp and well-defined so the candidate has room to demonstrate engineering depth without feeling overwhelmed.
  * STRICT PROHIBITION: Do NOT write long rambling paragraphs or endless sub-lists.
- QUESTION SCOPE:
  * Distributed systems trade-offs, concurrency race conditions, memory bottlenecks, high-scale database sharding, resilience patterns (circuit breakers, rate limiting).
- SCORING & EVALUATION FAIRNESS:
  * Grade on architectural reasoning, scalability trade-offs, and failure mitigation strategies.
  * A well-reasoned answer that navigates trade-offs effectively MUST receive 8.5/10 to 10/10.
  * Evaluate real-world engineering judgment rather than memorization of obscure trivia.
  * If the candidate thoroughly addresses the core challenge, "missingPoints" should be empty ([]).`;
  }

  return '';
};

const suggestResumeEdits = async (resumeText, targetRole, atsFindings = null) => {
  const cleanedResume = stripPlaceholders(resumeText);
  const missingKws = atsFindings && atsFindings.missingKeywords ? atsFindings.missingKeywords : [];
  const atsContext = missingKws.length > 0
    ? `\n\nCRITICAL TARGET KEYWORDS TO INCORPORATE:\n${JSON.stringify(missingKws, null, 2)}`
    : `\n\nOptimize this resume generally for the role "${targetRole}".`;

  const prompt = `You are an expert technical resume writer.
Suggest bullet point improvements and skill additions to better appeal to the target role: "${targetRole}".
${atsContext}

RESUME TEXT:
${cleanedResume.substring(0, 4000)}

Return ONLY a valid JSON array of objects with the following structure (no markdown, no extra text):
[
  {
    "section": "Experience" or "Projects" or "Technical Skills",
    "original": "original text if applicable or null",
    "suggestion": "improved bullet point or skill",
    "reason": "short explanation of why this improves ATS compatibility"
  }
]`;

  const responseText = await callOpenRouter(prompt, 0.2, getModel(), 'Resume Suggestions');
  return parseJSON(responseText, []);
};

// --- AI INTERVIEW COACH SERVICE ---
const resumeSummaryCache = new Map();

const summarizeResume = async (resumeText, role, difficulty) => {
  const cleanedResume = stripPlaceholders(resumeText);
  const defaultTopics = getDefaultTopicsForRole(role);
  if (!cleanedResume || cleanedResume.trim().length < 50) return { summary: '', topics: defaultTopics };

  const hash = crypto.createHash('sha1').update(cleanedResume + role + difficulty).digest('hex');
  if (resumeSummaryCache.has(hash)) {
    return resumeSummaryCache.get(hash);
  }

  const prompt = `Analyze the candidate's resume for a ${difficulty}-level ${role} interview.
Extract the candidate's technical profile and generate 5 distinct, sequential interview topics tailored to their projects, skills, and the target ${role} role at ${difficulty} difficulty.
Return ONLY valid JSON in this exact format:
{
  "summary": "Concise ~150-word technical profile highlighting project names, tech stack, internships, and key skills.",
  "topics": [
    "Topic 1 for Question 1",
    "Topic 2 for Question 2",
    "Topic 3 for Question 3",
    "Topic 4 for Question 4",
    "Topic 5 for Question 5"
  ]
}

RESUME:
${cleanedResume.substring(0, 4000)}`;

  const responseText = await callOpenRouter(prompt, 0.2, getInterviewModel(), 'Resume Summarization');
  const parsed = parseJSON(responseText, {});
  const result = {
    summary: parsed.summary || '',
    topics: Array.isArray(parsed.topics) && parsed.topics.length >= 5 ? parsed.topics.slice(0, 5) : defaultTopics
  };
  resumeSummaryCache.set(hash, result);
  return result;
};

const generateFirstQuestion = async (role, difficulty, resumeSummary = '', plannedTopic = '') => {
  const difficultyRules = getDifficultyGuidelines(difficulty);

  const prompt = `You are an expert technical interviewer conducting a ${difficulty}-level interview for a ${role} position.
${resumeSummary ? `Candidate Technical Profile:\n${resumeSummary}\n` : ''}
${plannedTopic ? `Current Question Topic (Mandatory Focus): ${plannedTopic}\n` : ''}

${difficultyRules}

QUESTION DESIGN RULES (PREVENT CANDIDATE OVERWHELM):
- Ask EXACTLY ONE single, clear, digestible technical question. Maximum 2-3 sentences.
- STRICTLY FORBIDDEN: Do NOT ask multi-part compound questions (no "1. ..., 2. ...", no asking 3 separate topics in one prompt). Focus on ONE scenario.
- Match the tone to an engaging, professional conversation. Do NOT prepend greetings, candidate names, or meta-commentary.

Output ONLY the question text (no conversational openers, no markdown formatting or extra commentary).`;

  const q = await callOpenRouter(prompt, 0.4, getInterviewModel(), 'First Interview Question Generation');
  return cleanQuestion(q);
};

const evaluateAndNext = async (role, difficulty, currentQuestion, userAnswer, questionNumber, totalQuestions, resumeSummary = '', nextTopic = '') => {
  const difficultyRules = getDifficultyGuidelines(difficulty);

  const prompt = `You are an expert technical interviewer conducting a ${difficulty}-level interview for a ${role} position.
${resumeSummary ? `Candidate Technical Profile:\n${resumeSummary}\n` : ''}
${nextTopic ? `Next Question Planned Topic (Mandatory Focus for nextQuestion): ${nextTopic}\n` : ''}

Current Question (${questionNumber}/${totalQuestions}): ${currentQuestion}
Candidate's Answer: ${userAnswer}

${difficultyRules}

SCORING & FEEDBACK RULES (FAIR & CALIBRATED TO ${difficulty.toUpperCase()} TIER):
- Standard 1-10 scale. If the candidate provides a thorough, accurate answer that satisfies the ${difficulty} tier expectations, award 9/10 or 10/10.
- For EASY: Score on basic conceptual understanding. Do NOT deduct for missing production scale or advanced architectures.
- For MEDIUM: Score on practical implementation and architectural clarity. Do NOT deduct for missing internal library variable names, obscure constants, or niche platform quirks.
- For HARD: Score on reasoning around scale, concurrency, and trade-offs. Do NOT deduct for memorization trivia.
- "missingPoints": Only list genuine, substantive gaps relevant to the ${difficulty} level. If the answer is comprehensive for this level, "missingPoints" should be an empty list [].
- "idealAnswerHint": Briefly state factually what a solid answer should emphasize at this ${difficulty} level (1-2 sentences).

NEXT QUESTION GENERATION RULES (if questionNumber < totalQuestions):
- "nextQuestion" MUST adhere strictly to the ${difficulty} tier guidelines above.
- Ask EXACTLY ONE focused, digestible question (max 2-3 sentences).
- STRICTLY FORBIDDEN: Do NOT ask multi-part questions or bundle multiple distinct technologies into one prompt. Focus purely on "${nextTopic || role}".
- Do NOT include candidate names or greetings.

Output ONLY valid JSON in this exact format:
{
  "score": number (1 to 10),
  "topic": string,
  "goodPoints": string[],
  "missingPoints": string[],
  "idealAnswerHint": string,
  "nextQuestion": string (or null if questionNumber >= totalQuestions)
}`;

  const responseText = await callOpenRouter(prompt, 0.3, getReasoningModel(), 'Interview Answer Evaluation & Next');
  const result = parseJSON(responseText, {
    score: 8,
    topic: nextTopic || 'Technical Engineering',
    goodPoints: ['Answer addressed the core question.'],
    missingPoints: [],
    idealAnswerHint: 'A complete technical answer should explain the core mechanics and practical implementation.',
    nextQuestion: null
  });

  if (typeof result.score === 'number') {
    result.score = Math.min(10, Math.max(1, Number(result.score.toFixed(1))));
  } else {
    result.score = 7.5;
  }
  if (!Array.isArray(result.missingPoints)) {
    result.missingPoints = [];
  }
  if (result.nextQuestion) {
    result.nextQuestion = cleanQuestion(result.nextQuestion);
  }
  return result;
};

const generateSummary = async (role, difficulty, allQA) => {
  const qaHistory = allQA.map((qa, index) => {
    const topicOrQ = qa.topic || qa.question.split('?')[0].slice(0, 50);
    const missing = qa.missingPoints && qa.missingPoints.length ? qa.missingPoints.join('; ') : 'None';
    return `Q${index + 1} (${topicOrQ}): Score ${qa.score}/10 | Gaps: ${missing}`;
  }).join('\n');

  const prompt = `You are an expert technical interviewer summarizing a completed ${difficulty}-level interview for a ${role} position.
Candidate Performance by Question:
${qaHistory}

Provide an overall assessment and performance summary with an overallScore from 1 to 10 (decimal allowed, e.g., 8.5; up to 10.0).
Grade fairly based on the ${difficulty} difficulty expectations without hyper-strict penalties.
Output ONLY valid JSON in this exact format:
{
  "overallScore": number (1 to 10),
  "strengths": string[],
  "weaknesses": string[],
  "summary": string
}`;

  const responseText = await callOpenRouter(prompt, 0.3, getReasoningModel(), 'Final Interview Summary');
  const result = parseJSON(responseText, {
    overallScore: 8,
    strengths: ['Demonstrated solid grasp of technical basics.'],
    weaknesses: [],
    summary: 'Candidate showed capable knowledge across the technical interview.'
  });

  if (typeof result.overallScore === 'number') {
    result.overallScore = Math.min(10, Math.max(1, Number(result.overallScore.toFixed(1))));
  } else {
    result.overallScore = 8;
  }
  return result;
};

module.exports = {
  callOpenRouter,
  parseJSON,
  getDefaultTopicsForRole,
  getDifficultyGuidelines,
  suggestResumeEdits,
  summarizeResume,
  generateFirstQuestion,
  evaluateAndNext,
  generateSummary
};