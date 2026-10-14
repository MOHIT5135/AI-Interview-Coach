const axios = require('axios');
const crypto = require('crypto');

const getModel = () => process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

const getBaseUrl = () => {
  let url = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  if (url.endsWith('/')) url = url.slice(0, -1);
  return url;
};

const callOpenRouter = async (prompt, temperature = 0.3) => {
  try {
    const headers = {
      'HTTP-Referer': 'https://ai-interview-coach.local',
      'X-Title': 'AI Interview Coach',
      'Content-Type': 'application/json',
    };

    if (process.env.OPENROUTER_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
    }

    const response = await axios.post(
      `${getBaseUrl()}/chat/completions`,
      {
        model: getModel(),
        messages: [{ role: 'user', content: prompt }],
        temperature: temperature,
      },
      { headers }
    );

    if (response.data.usage) {
      console.log('Token Usage:', response.data.usage);
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

const parseJSON = (content) => {
  try {
    let cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse JSON from AI response:', content);
    throw new Error('AI returned invalid response format.');
  }
};

// ---------- ATS helpers ----------
const stem = (w) => {
  if (w.length <= 3 || /[^a-z]/.test(w)) return w; // keeps node.js, c++, es6
  let s = w;
  if (s.endsWith('ies') && s.length > 4) s = s.slice(0, -3) + 'y';
  else if (/(sses|xes|ches|shes)$/.test(s)) s = s.slice(0, -2);
  else if (s.endsWith('s') && !/(ss|us|is)$/.test(s)) s = s.slice(0, -1);
  if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith('ed')) s = s.slice(0, -2);
  if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1);
  return s;
};

const tokenize = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/\.js\b/g, ' js')
    .replace(/[-/]/g, ' ')
    .replace(/[^a-z0-9+#.\s]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean)
    .map(stem);

const phraseIn = (resTokens, phrase) => {
  const p = tokenize(phrase);
  if (!p.length) return false;
  const win = p.length === 1 ? 1 : p.length + 3;
  const set = new Set(p);
  for (let i = 0; i < resTokens.length; i++) {
    if (!set.has(resTokens[i])) continue;
    if (p.every((t) => resTokens.slice(i, i + win).includes(t))) return true;
  }
  return false;
};

const degreeMatch = (resTokens, resumeText, k) => {
  const t = k.term.toLowerCase();
  const hasDegreeTerm = t.includes('degree') || t.includes('bachelor') || t.includes('master') || t.includes('b.tech') || t.includes('bsc') || t.includes('mca') || t.includes('b.e');
  if (hasDegreeTerm) {
    const lowerRes = resumeText.toLowerCase();
    const hasEduLevel = /(b\.?tech|b\.?e\.?|b\.?sc|m\.?tech|m\.?ca|bachelor|master|degree|graduate)/.test(lowerRes);
    const hasField = t.includes('computer science') ? /(computer science|cse|it|information technology|software engineering)/.test(lowerRes) : true;
    if (hasEduLevel && hasField) return true;
  }
  return false;
};

const formatChecks = (resume) => {
  const issues = [];
  const lower = resume.toLowerCase();
  if (!/[\w.+-]+@[\w-]+\.[\w.]+/.test(resume)) issues.push('No email address found.');
  if (!/\+?\d[\d\s().-]{8,}\d/.test(resume)) issues.push('No phone number found.');
  if (!/(experience|employment|work history|internship)/.test(lower)) issues.push('No clear Experience section heading found.');
  if (!/(education|qualification|academic)/.test(lower)) issues.push('No clear Education section heading found.');
  if (!/(skills|competenc|expertise)/.test(lower)) issues.push('No clear Skills section heading found.');
  if (/\[\s*insert/i.test(resume) || resume.includes('[Insert')) {
    issues.push('Unfilled placeholder text found. Replace it before applying.');
  }
  if (/[�ïÐ§]/.test(resume)) issues.push('Unusual symbols were found, probably from icons in the contact line. Use plain text for contact details.');
  return issues;
};

const kwCache = new Map(); // same JD -> same keywords -> same score

// --- ATS CHECKER SERVICE ---
const checkResumeATS = async (resumeText, jobDescription) => {
  console.log('NEW ATS CODE RUNNING');
  const resume = String(resumeText || '');
  const jd = String(jobDescription || '').trim();
  const jdWords = jd.split(/\s+/).filter(Boolean).length;

  const empty = {
    matchScore: 0, rawScore: 0, matchedKeywords: [], missingKeywords: [], missingRequired: [],
    formattingIssues: [], suggestions: [], confidence: 'low', note: '',
  };

  if (resume.trim().length < 200) {
    return { ...empty, formattingIssues: ['Very little text could be read. The PDF may be a scanned image. Export a text-based PDF.'] };
  }
  if (jdWords === 0) {
    return { ...empty, formattingIssues: formatChecks(resume), note: 'Paste a job description, or at least a job title.' };
  }

  const jdKey = crypto.createHash('sha1').update(jd.toLowerCase().replace(/\s+/g, ' ')).digest('hex');
  let parsed = kwCache.get(jdKey);

  if (!parsed) {
    const prompt = `You are an ATS keyword extractor. You work for ANY profession.

JOB DESCRIPTION:
${jd.substring(0, 4000)}

Extract what a recruiter would screen for: hard skills, tools/software, methods, certifications/licenses, degrees, domain terms. Soft skills only if the JD stresses them (max 3).

RULES:
- "term": short (1-4 words).
- "synonyms": 0-6 other ways the same thing is written on a resume (abbreviations, full names, variants, related wording such as "system design" for "system architecture").
- ALTERNATIVES: if the role accepts any one of several options (React OR Angular OR Vue; AWS OR Azure OR GCP; SQL OR NoSQL), output ONE term for the category (for example "frontend framework", "cloud platform", "database") and put every option in "synonyms". Do NOT list each option as its own keyword.
- GENERAL TERMS: if a general term is normally shown through specific tools (for example "NoSQL" through MongoDB, Redis), put those tools in "synonyms".
- "importance": "required" if the JD says required/must/essential or it is central to the role, otherwise "preferred".
- Never output sentences or comments about the JD. Never invent requirements that are not in the JD.
- Do not include degree or education requirements unless the job description explicitly states them.
- If the JD is only a job title or lists almost no skills, set "inferred": true and return the 10 most standard requirements for that role.
- Return 6-20 items, most important first.

Output ONLY JSON:
{"jobTitle": "...", "inferred": false, "keywords": [{"term": "...", "synonyms": ["..."], "importance": "required"}]}`;

    parsed = parseJSON(await callOpenRouter(prompt, 0));
    kwCache.set(jdKey, parsed);
    if (kwCache.size > 200) kwCache.delete(kwCache.keys().next().value);
  }

  const seen = new Set();
  const keywords = (parsed.keywords || [])
    .map((k) => ({
      term: String(k.term || '').trim(),
      synonyms: Array.isArray(k.synonyms) ? k.synonyms.map((s) => String(s).trim()).filter(Boolean) : [],
      required: String(k.importance).toLowerCase() === 'required',
    }))
    .filter((k) => k.term && k.term.length <= 40 && k.term.split(/\s+/).length <= 4)
    .filter((k) => {
      const key = k.term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);

  const resTokens = tokenize(resume);
  let got = 0, total = 0;
  const matched = [], missingOptional = [], missingRequired = [];

  for (const k of keywords) {
    const weight = k.required ? 2 : 1;
    total += weight;
    const hit = [k.term, ...k.synonyms].some((v) => phraseIn(resTokens, v)) || degreeMatch(resTokens, resume, k);
    if (hit) { got += weight; matched.push(k.term); }
    else if (k.required) missingRequired.push(k.term);
    else missingOptional.push(k.term);
  }

  const rawScore = total ? Math.round((got / total) * 100) : 0;
  const missingKeywords = [...missingRequired, ...missingOptional];
  const lowConfidence = Boolean(parsed.inferred) || jdWords < 30;
  const matchScore = lowConfidence ? Math.min(rawScore, 85) : rawScore;

  let suggestions = [];
  if (rawScore < 25) {
    suggestions = ['This job description is a poor match for your resume profile (score under 25%). Consider targeting roles that align more closely with your technical skills and experience.'];
  } else if (missingKeywords.length) {
    try {
      const sPrompt = `Job title: ${parsed.jobTitle || 'the target role'}

RESUME:
${resume.substring(0, 4000)}

Keywords the resume does not show: ${missingKeywords.slice(0, 8).join(', ')}.

Give up to 3 short, concrete suggestions for adding these.
RULES:
- Only suggest adding a keyword where the candidate plausibly has the experience; say "if you have used it".
- Never suggest removing or replacing anything already on the resume.
- Never suggest something the resume already contains.
- No generic advice such as "tailor your summary".
Output ONLY a JSON array of strings.`;
      suggestions = parseJSON(await callOpenRouter(sPrompt, 0));
    } catch (e) {
      suggestions = [];
    }
  }

  return {
    matchScore,
    rawScore,
    matchedKeywords: matched,
    missingKeywords,
    missingRequired,
    formattingIssues: formatChecks(resume),
    suggestions,
    confidence: lowConfidence ? 'low' : 'high',
    note: lowConfidence
      ? 'The job description is short, so the score uses standard requirements for this role (capped at 85%). Paste the full JD for an accurate score.'
      : '',
  };
};

// --- RESUME OPTIMIZER SERVICE ---
const suggestResumeEdits = async (resumeText, targetRole, atsFindings = null) => {
  const atsContext = atsFindings
    ? `\n\nCRITICAL ATS FEEDBACK TO ADDRESS:\n${JSON.stringify(atsFindings, null, 2)}`
    : '';

  const prompt = `You are an expert technical resume writer.
Suggest bullet point improvements to better appeal to the target role: "${targetRole}".
${atsContext}

RESUME TEXT:
${resumeText.substring(0, 4000)}

Analyze each experience/project bullet point.
For each bullet point, suggest an optimized version if it can be improved for better ATS matching or impact.

CRITICAL: DO NOT invent new work history. Only enhance existing bullets.

Return ONLY a valid JSON array of objects with the following structure (no markdown, no extra text):
[
  {
    "section": "Experience", // or "Projects"
    "originalBullet": "Original text...",
    "suggestedBullet": "Improved, ATS-optimized version...",
    "reason": "Why this is better (e.g., added keyword: Docker)"
  }
]
`;

  const responseText = await callOpenRouter(prompt);
  return parseJSON(responseText);
};

// --- AI INTERVIEW COACH SERVICE ---
const resumeSummaryCache = new Map();

const summarizeResume = async (resumeText) => {
  if (!resumeText || resumeText.trim().length < 50) return '';
  const hash = crypto.createHash('sha1').update(resumeText).digest('hex');
  if (resumeSummaryCache.has(hash)) {
    return resumeSummaryCache.get(hash);
  }
  const prompt = `Summarize the following resume into a concise ~150-word technical profile highlighting project names, tech stack, internships, and key skills. Plain text only.

RESUME:
${resumeText.substring(0, 4000)}`;

  const summary = await callOpenRouter(prompt, 0.2);
  resumeSummaryCache.set(hash, summary);
  if (resumeSummaryCache.size > 100) resumeSummaryCache.delete(resumeSummaryCache.keys().next().value);
  return summary;
};

const generateFirstQuestion = async (role, difficulty, resumeSummary = '') => {
  const prompt = `You are an expert technical interviewer conducting a ${difficulty}-level interview for a ${role} position.
${resumeSummary ? `Candidate Technical Profile:\n${resumeSummary}\n` : ''}
Generate the first interview question. Make it engaging, professional, and tailored to the candidate's background and role/difficulty level.
Output ONLY the question text (no markdown formatting or extra commentary).`;

  return await callOpenRouter(prompt, 0.4);
};

const evaluateAndNext = async (role, difficulty, currentQuestion, userAnswer, questionNumber, totalQuestions, resumeSummary = '') => {
  const prompt = `You are an expert technical interviewer conducting a ${difficulty}-level interview for a ${role} position.
${resumeSummary ? `Candidate Technical Profile:\n${resumeSummary}\n` : ''}
Question (${questionNumber}/${totalQuestions}): ${currentQuestion}
Candidate's Answer: ${userAnswer}

Evaluate the candidate's answer on a scale of 0 to 10 (decimal allowed, e.g. 7.5).
Formulate the next question (if questionNumber < totalQuestions), ensuring it references items or projects from the candidate's profile where appropriate.
Output ONLY valid JSON in this exact format:
{
  "score": number (0 to 10),
  "goodPoints": string[],
  "missingPoints": string[],
  "idealAnswerHint": string,
  "nextQuestion": string (or null if questionNumber >= totalQuestions)
}`;

  const responseText = await callOpenRouter(prompt, 0.3);
  const result = parseJSON(responseText);
  if (typeof result.score === 'number') {
    result.score = Math.max(0, Math.min(10, Number(result.score.toFixed(1))));
  } else {
    result.score = 5;
  }
  return result;
};

const generateSummary = async (role, difficulty, allQA) => {
  const qaHistory = allQA.map((qa, index) => `Q${index + 1}: ${qa.question}\nAnswer: ${qa.userAnswer}\nScore: ${qa.score}/10`).join('\n\n');

  const prompt = `You are an expert technical interviewer summarizing a completed ${difficulty}-level interview for a ${role} position.
Interview Q&A History:
${qaHistory}

Provide an overall assessment and performance summary with an overallScore from 0 to 10 (decimal allowed, e.g., 8.2).
Output ONLY valid JSON in this exact format:
{
  "overallScore": number (0 to 10),
  "strengths": string[],
  "weaknesses": string[],
  "summary": string
}`;

  const responseText = await callOpenRouter(prompt, 0.3);
  const result = parseJSON(responseText);
  if (typeof result.overallScore === 'number') {
    result.overallScore = Math.max(0, Math.min(10, Number(result.overallScore.toFixed(1))));
  } else {
    result.overallScore = 7;
  }
  return result;
};

const optimizeResumeToJSON = async (resumeText, targetRole, suggestions) => {
  const prompt = `You are an expert resume parser and writer.
Given the following RESUME TEXT and a list of SUGGESTED BULLET IMPROVEMENTS, extract the complete resume information and return a JSON object matching this exact schema for rendering a professional resume:
{
  "name": "Candidate Name",
  "role": "${targetRole}",
  "contact": "Phone | Email | LinkedIn | GitHub",
  "summary": "Professional summary...",
  "skills": {
    "Frontend": "React, JavaScript, ...",
    "Backend": "Node.js, Express, ..."
  },
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "date": "Date range",
      "bullets": ["bullet 1 with optimized text applied if applicable", "bullet 2..."]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "links": "GitHub / Live Link",
      "date": "Date",
      "bullets": ["optimized bullets..."]
    }
  ],
  "education": [
    {
      "degree": "Degree name",
      "institution": "School name",
      "date": "Year"
    }
  ]
}

RESUME TEXT:
${resumeText.substring(0, 4000)}

SUGGESTED BULLET IMPROVEMENTS:
${JSON.stringify(suggestions, null, 2)}

Return ONLY valid JSON with no markdown formatting.`;

  const responseText = await callOpenRouter(prompt, 0);
  return parseJSON(responseText);
};

module.exports = {
  checkResumeATS,
  suggestResumeEdits,
  optimizeResumeToJSON,
  generateFirstQuestion,
  evaluateAndNext,
  generateSummary,
  summarizeResume
};
