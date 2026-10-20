'use strict';
const { callGeminiAI, getModel: defaultGetModel } = require('../services/aiService');

function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeForMatch(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)
    .map(w => w.replace(/s\b/g, '').replace(/ful\b/g, ''))
    .join(' ');
}

function matchTermInText(term, text) {
  const cleanTerm = term.trim();
  if (!cleanTerm) return false;
  const escaped = escapeRegExp(cleanTerm);
  const regex = new RegExp(`(^|\\s|[.,/#!$%^&*;:{}=\\-_~\`()])(${escaped})(?=$|\\s|[.,/#!$%^&*;:{}=\\-_~\`()])`, 'i');
  if (regex.test(text)) return true;

  const normTerm = normalizeForMatch(cleanTerm);
  const normText = normalizeForMatch(text);
  if (!normTerm) return false;

  const termTokens = normTerm.split(/\s+/);
  const textTokens = new Set(normText.split(/\s+/));

  if (termTokens.every(tok => textTokens.has(tok))) {
    return true;
  }

  if (normText.includes(normTerm)) {
    return true;
  }

  return false;
}

// Safely resolves model whether it's a function, string, or undefined
const resolveModel = (modelOrFn) => {
  if (typeof modelOrFn === 'function') {
    try {
      const res = modelOrFn();
      if (res) return String(res);
    } catch (_) {}
  }
  if (typeof modelOrFn === 'string' && modelOrFn.trim()) {
    return modelOrFn.trim();
  }
  if (typeof defaultGetModel === 'function') {
    try {
      const res = defaultGetModel();
      if (res) return String(res);
    } catch (_) {}
  }
  return 'gemini-2.0-flash';
};

const extractJDSkillsUniversal = async (rawJobDescription, callAiFn = callGeminiAI, modelOrFn = defaultGetModel) => {
  const universalJdPrompt = `
Analyze this Job Description and extract the core required competencies, skills, tools, and certifications.
For each requirement, provide an array of common industry synonyms or abbreviations.
Exclude generic corporate buzzwords (e.g., "team player", "hard worker").

CRITICAL RULE FOR "OR" / ALTERNATIVES:
If the job description asks for "A or B" (e.g., "MongoDB or PostgreSQL", "Kafka or RabbitMQ"), you MUST group them into a single competency object. Set one as the keyword and the others as synonyms.

Return ONLY a JSON array of objects in this format:
[
  { "keyword": "mongodb", "synonyms": ["postgresql", "postgres"] },
  { "keyword": "guest relations", "synonyms": ["customer service", "guest experience"] }
]

JD: "${rawJobDescription}"
`;

  try {
    const aiCaller = typeof callAiFn === 'function' ? callAiFn : callGeminiAI;
    const resolvedModel = resolveModel(modelOrFn);

    console.log(`\n[ATS Competency Extraction] Calling Google AI Studio with model: "${resolvedModel}"...`);
    const response = await aiCaller(universalJdPrompt, 0, resolvedModel, 'ATS Universal Competencies Extraction');
    let cleaned = String(response || '').replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }
    const parsed = JSON.parse(cleaned);
    const list = Array.isArray(parsed) ? parsed : [];
    console.log(`[ATS Competency Extraction] Extracted ${list.length} competencies from JD.`);
    return list;
  } catch (err) {
    console.error('Failed to extract universal competencies dynamically with Google AI Studio:', err.message);
    return [];
  }
};

function calculateUniversalATSScore(resumeJson, competencyArray) {
  let score = 0;
  const maxPossibleScore = Math.max(1, competencyArray.length * 2);

  const matchedKeywords = [];
  const missingKeywords = [];

  const experienceArr = Array.isArray(resumeJson.experience) ? resumeJson.experience : (resumeJson.experience ? [resumeJson.experience] : []);
  const projectsArr = Array.isArray(resumeJson.projects) ? resumeJson.projects : (resumeJson.projects ? [resumeJson.projects] : []);
  const clinicalArr = Array.isArray(resumeJson.clinical_rotations) ? resumeJson.clinical_rotations : [];
  const researchArr = Array.isArray(resumeJson.research) ? resumeJson.research : [];

  // Active Text: High-value applied experience & projects (Weight 2)
  const activeText = [
    ...experienceArr.map(e => typeof e === 'object' ? `${e.title || ''} ${e.company || ''} ${(e.bullets || []).join(' ')}` : String(e)),
    ...projectsArr.map(p => typeof p === 'object' ? `${p.name || ''} ${p.techStack || ''} ${(p.bullets || []).join(' ')}` : String(p)),
    ...clinicalArr.map(c => typeof c === 'object' ? `${c.title || ''} ${(c.bullets || []).join(' ')}` : String(c)),
    ...researchArr.map(r => typeof r === 'object' ? `${r.title || ''} ${(r.bullets || []).join(' ')}` : String(r))
  ].join(' ').toLowerCase();

  const skillsObj = resumeJson.skills
    ? (typeof resumeJson.skills === 'object' ? Object.values(resumeJson.skills).join(' ') : String(resumeJson.skills))
    : '';
  const certsArr = Array.isArray(resumeJson.certifications) ? resumeJson.certifications.join(' ') : String(resumeJson.certifications || '');
  const summaryText = String(resumeJson.summary || '');

  const eduArr = Array.isArray(resumeJson.education)
    ? resumeJson.education.map(e => typeof e === 'object' ? Object.values(e).join(' ') : String(e)).join(' ')
    : String(resumeJson.education || '');

  // Passive Text: Skills listings, summary, education (Weight 1)
  const passiveText = [skillsObj, certsArr, summaryText, eduArr].join(' ').toLowerCase();

  console.log(`\n--- [ATS Dual-Weight Matching Engine] ---`);
  console.log(`[Active Corpus Length]  : ${activeText.length} characters (Experience + Projects)`);
  console.log(`[Passive Corpus Length] : ${passiveText.length} characters (Skills + Summary + Education)`);

  competencyArray.forEach(item => {
    const keyword = String(item.keyword || '').toLowerCase().trim();
    const synonyms = Array.isArray(item.synonyms) ? item.synonyms.map(s => String(s).toLowerCase().trim()) : [];
    const allTerms = [keyword, ...synonyms].filter(Boolean);

    let keywordScore = 0;
    let matchedTerm = keyword;
    let matchedIn = '';

    for (const term of allTerms) {
      if (matchTermInText(term, activeText)) {
        keywordScore = 2; // Weight 2 for applied experience/projects
        matchedTerm = term;
        matchedIn = 'Experience/Projects (Weight 2)';
        break;
      } else if (matchTermInText(term, passiveText)) {
        keywordScore = 1; // Weight 1 for passive skills bank
        matchedTerm = term;
        matchedIn = 'Skills/Summary (Weight 1)';
      }
    }

    if (keywordScore > 0) {
      score += keywordScore;
      matchedKeywords.push({ keyword, matchedAs: matchedTerm, weight: keywordScore, matchedIn });
      console.log(`  ✓ Matched: "${keyword}" (via "${matchedTerm}") -> +${keywordScore} pts [${matchedIn}]`);
    } else {
      missingKeywords.push(keyword);
      console.log(`  ✗ Missing: "${keyword}" (checked: ${allTerms.join(', ')}) -> 0 pts`);
    }
  });

  const matchPercentage = Math.min(100, Math.round((score / maxPossibleScore) * 100));
  const totalCompetencies = Math.max(1, competencyArray.length);
  const competencyCoverage = Math.round((matchedKeywords.length / totalCompetencies) * 100);

  console.log(`[Competency Coverage]      : ${matchedKeywords.length} / ${totalCompetencies} matched => ${competencyCoverage}%`);
  console.log(`[Evidence Weighted Score]   : ${score} / ${maxPossibleScore} pts => ${matchPercentage}%`);
  console.log(`[ATS Score Calculation] Total Points: ${score} / ${maxPossibleScore} => ${matchPercentage}%\n`);

  // Industrial-Grade ATS Metrics Audit
  const allBullets = [
    ...experienceArr.flatMap(e => (typeof e === 'object' && Array.isArray(e.bullets)) ? e.bullets : (typeof e === 'string' ? [e] : [])),
    ...projectsArr.flatMap(p => (typeof p === 'object' && Array.isArray(p.bullets)) ? p.bullets : (typeof p === 'string' ? [p] : []))
  ];

  let bulletsWithMetrics = 0;
  let bulletsWithStrongVerbs = 0;
  const strongVerbs = ['engineered', 'architected', 'optimized', 'spearheaded', 'developed', 'deployed', 'implemented', 'designed', 'led', 'accelerated', 'automated', 'reduced', 'increased', 'built', 'transformed', 'delivered', 'pioneered'];

  allBullets.forEach(b => {
    const text = String(b).trim();
    if (/\d+%|\$\d+|\d+\s*(users|requests|ms|seconds|latency|hours|days|x\b|queries|records)/i.test(text)) {
      bulletsWithMetrics++;
    }
    const firstWord = text.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
    if (strongVerbs.includes(firstWord)) {
      bulletsWithStrongVerbs++;
    }
  });

  const totalBullets = Math.max(1, allBullets.length);
  const metricPercentage = Math.round((bulletsWithMetrics / totalBullets) * 100);
  const strongVerbPercentage = Math.round((bulletsWithStrongVerbs / totalBullets) * 100);
  const formattingScore = (resumeJson.skills && Object.keys(resumeJson.skills).length > 0 && resumeJson.summary) ? 100 : 75;

  const industrialScore = Math.min(100, Math.round(
    (matchPercentage * 0.40) +
    (formattingScore * 0.20) +
    (metricPercentage * 0.20) +
    (strongVerbPercentage * 0.20)
  ));

  return {
    matchPercentage: industrialScore,
    keywordMatchPercentage: matchPercentage,
    competencyCoverage,
    formattingScore,
    metricPercentage,
    strongVerbPercentage,
    matchedKeywords,
    missingKeywords,
    score,
    maxPossibleScore
  };
}

module.exports = {
  extractJDSkillsUniversal,
  calculateUniversalATSScore,
  matchTermInText
};