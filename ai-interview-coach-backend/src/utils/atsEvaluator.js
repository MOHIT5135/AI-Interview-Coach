const axios = require('axios');

function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchTermInText(term, text) {
  const cleanTerm = term.trim();
  if (!cleanTerm) return false;
  const escaped = escapeRegExp(cleanTerm);
  const regex = new RegExp(`(^|\\s|[.,/#!$%^&*;:{}=\\-_~\`()])(${escaped})(?=$|\\s|[.,/#!$%^&*;:{}=\\-_~\`()])`, 'i');
  return regex.test(text);
}

const extractJDSkillsUniversal = async (rawJobDescription, callOpenRouterFn, getModelFn) => {
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
    const response = await callOpenRouterFn(universalJdPrompt, 0, getModelFn(), 'ATS Universal Competencies Extraction');
    let cleaned = String(response || '').replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to extract universal competencies dynamically:', err.message);
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

  const activeText = [
    ...experienceArr,
    ...projectsArr,
    ...clinicalArr,
    ...researchArr
  ].map(item => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(' ').toLowerCase();

  const skillsObj = resumeJson.skills
    ? (typeof resumeJson.skills === 'object' ? Object.values(resumeJson.skills).join(' ') : String(resumeJson.skills))
    : '';
  const certsArr = Array.isArray(resumeJson.certifications) ? resumeJson.certifications.join(' ') : String(resumeJson.certifications || '');
  const summaryText = String(resumeJson.summary || '');

  const eduArr = Array.isArray(resumeJson.education)
    ? resumeJson.education.map(e => typeof e === 'object' ? Object.values(e).join(' ') : String(e)).join(' ')
    : String(resumeJson.education || '');

  const passiveText = [
    skillsObj,
    certsArr,
    summaryText,
    eduArr
  ].join(' ').toLowerCase();

  competencyArray.forEach(item => {
    const keyword = String(item.keyword || '').toLowerCase().trim();
    const synonyms = Array.isArray(item.synonyms) ? item.synonyms.map(s => String(s).toLowerCase().trim()) : [];
    const allTerms = [keyword, ...synonyms].filter(Boolean);

    let keywordScore = 0;
    let matchedTerm = keyword;

    for (const term of allTerms) {
      if (matchTermInText(term, activeText)) {
        keywordScore = 2;
        matchedTerm = term;
        break;
      } else if (matchTermInText(term, passiveText)) {
        keywordScore = 1;
        matchedTerm = term;
      }
    }

    if (keywordScore > 0) {
      score += keywordScore;
      matchedKeywords.push({ keyword, matchedTerm, weight: keywordScore });
    } else {
      missingKeywords.push(keyword);
    }
  });

  const matchPercentage = Math.round((score / maxPossibleScore) * 100);

  return {
    matchPercentage,
    matchedKeywords,
    missingKeywords
  };
}

module.exports = { extractJDSkillsUniversal, calculateUniversalATSScore, escapeRegExp, matchTermInText };
