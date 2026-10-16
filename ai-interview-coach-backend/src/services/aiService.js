const axios = require('axios');
const crypto = require('crypto');
const AtsCache = require('../models/AtsCache');
const AtsAlias = require('../models/AtsAlias');

const getModel = () => process.env.OPENROUTER_MODEL || 'antigravity/gemini-3-flash';
const getInterviewModel = () => process.env.INTERVIEW_MODEL || process.env.OPENROUTER_MODEL || 'antigravity/gemini-3-flash';
const getReasoningModel = () => process.env.REASONING_MODEL || 'antigravity/gemini-3.8-flash-high';
// Add recordUserAlias export
const recordUserAlias = async (userId, term, resumePhrase) => {
  return await AtsAlias.create({
    userId,
    term: term.toLowerCase().trim(),
    resumePhrase: resumePhrase.toLowerCase().trim()
  });
};

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

const parseJSON = (content) => {
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
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;

      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

      return JSON.parse(repaired);
    }
  } catch (e) {
    console.error('Failed to parse JSON from AI response:', content);
    return { jobTitle: 'Professional Role', inferred: true, requirements: [] };
  }
};

const stripPlaceholders = (text) => {
  return String(text || '')
    .replace(/\[\s*insert[^\]]*\]/gi, '')
    .replace(/\[\s*enter[^\]]*\]/gi, '');
};

const cleanQuestion = (text) => {
  return String(text || '')
    .replace(/^(hi|hello|welcome|thanks|thank you|great answer|good job|moving on|next|mohit)[^.!?]*[.!?]\s*/gi, '')
    .replace(/^(dear|candidate)\s+[^,.!?]*[,.]?\s*/gi, '')
    .trim();
};

const getDifficultyGuidelines = (difficulty) => {
  const level = String(difficulty).toLowerCase();

  if (level === 'easy') {
    return `DIFFICULTY RULES - EASY:
- Focus on foundational concepts, definitions, and basic syntax.
- Ask "What is X?" or "Explain the basic difference between X and Y."
- DO NOT ask about complex architectural trade-offs, scalability, or edge cases.`;
  }

  if (level === 'medium') {
    return `DIFFICULTY RULES - MEDIUM:
- Focus on practical implementation, standard component design, and daily debugging.
- Ask "How would you implement X?" or "How do you handle state/data flow in Y?"
- Expect the candidate to explain their thought process for building a standard feature.
- DO NOT ask about extreme scale (millions of users) or advanced distributed systems unless explicitly on their resume.`;
  }

  if (level === 'hard') {
    return `DIFFICULTY RULES - HARD:
- Focus on production edge cases, performance bottlenecks, and architectural trade-offs at scale.
- Ask "How would you optimize X for high concurrency?", "How do you handle failure modes in Y?", or "Identify the memory leak/race condition here."
- Force the candidate to defend their architectural choices against constraints like latency, throughput, or fault tolerance.`;
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
    "originalBullet": "Original text...",
    "suggestedBullet": "Improved, ATS-optimized version...",
    "reason": "Why this is better"
  }
]
`;

  const responseText = await callOpenRouter(prompt, 0.2, getModel(), 'Resume Bullet Edits & Suggestions');
  return parseJSON(responseText);
};

// --- AI INTERVIEW COACH SERVICE ---
const resumeSummaryCache = new Map();

const summarizeResume = async (resumeText, role, difficulty) => {
  const cleanedResume = stripPlaceholders(resumeText);
  if (!cleanedResume || cleanedResume.trim().length < 50) return { summary: '', topics: [] };
  const hash = crypto.createHash('sha1').update(cleanedResume + role + difficulty).digest('hex');
  if (resumeSummaryCache.has(hash)) {
    return resumeSummaryCache.get(hash);
  }
  const prompt = `Analyze the candidate's resume for a ${difficulty}-level ${role} interview.
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
  const parsed = parseJSON(responseText);
  const result = {
    summary: parsed.summary || '',
    topics: Array.isArray(parsed.topics) && parsed.topics.length >= 5 ? parsed.topics.slice(0, 5) : [
      'React Component Design',
      'API Integration & Async Operations',
      'Frontend State Management',
      'UI Performance & Optimization',
      'Version Control & Collaboration'
    ]
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

Generate the first interview question. Make it engaging, professional, and strictly focused on the assigned topic. Do NOT start the question with the candidate's name.
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

SCORING & FEEDBACK RULES:
- Strict 0-10 scale. Cap all scores at maximum 9/10 (10/10 is disallowed).
- For EASY: Score based on clear definitions and basic understanding.
- For MEDIUM: Penalize if they cannot explain the "how" and practical implementation.
- For HARD: Heavily penalize if they ignore edge cases, scale, or trade-offs.
- You MUST identify at least one concrete technical gap or missing detail in "missingPoints". "missingPoints" must NEVER be empty.
- "idealAnswerHint": State factually what a complete technical answer should cover.

Output ONLY valid JSON in this exact format:
{
  "score": number (0 to 9),
  "topic": string,
  "goodPoints": string[],
  "missingPoints": string[],
  "idealAnswerHint": string,
  "nextQuestion": string (or null if questionNumber >= totalQuestions)
}`;

  const responseText = await callOpenRouter(prompt, 0.3, getReasoningModel(), 'Interview Answer Evaluation & Next');
  const result = parseJSON(responseText);

  if (typeof result.score === 'number') {
    result.score = Math.min(9, Math.max(1, Number(result.score.toFixed(1))));
  } else {
    result.score = 5;
  }
  if (!result.missingPoints || !result.missingPoints.length) {
    result.missingPoints = ['Could further detail specific edge cases, failure modes, and performance trade-offs.'];
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

Provide an overall assessment and performance summary with an overallScore from 0 to 10 (decimal allowed, e.g., 7.8; cap at 9.0).
Output ONLY valid JSON in this exact format:
{
  "overallScore": number (0 to 9),
  "strengths": string[],
  "weaknesses": string[],
  "summary": string
}`;

  const responseText = await callOpenRouter(prompt, 0.3, getReasoningModel(), 'Final Interview Summary');
  const result = parseJSON(responseText);
  if (typeof result.overallScore === 'number') {
    result.overallScore = Math.min(9, Math.max(1, Number(result.overallScore.toFixed(1))));
  } else {
      result.overallScore = 7;
    }
  return result;
};

module.exports = {
  callOpenRouter,
  parseJSON,
  suggestResumeEdits,
  summarizeResume,
  generateFirstQuestion,
  evaluateAndNext,
  generateSummary,
  recordUserAlias
};
