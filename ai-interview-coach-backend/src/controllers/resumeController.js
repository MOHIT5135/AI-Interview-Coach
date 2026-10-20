'use strict';
const { recordUserAlias, callGeminiAI, getModel } = require('../services/aiService');
const { renderResumeToPDF } = require('../services/puppeteerService');
const { parseResumeBuffer } = require('../utils/resumeParser');
const { extractJDSkillsUniversal, calculateUniversalATSScore } = require('../utils/atsEvaluator');
const { createBulletMap, optimizeBulletsWithAI } = require('../utils/aiEditor');
const { getOrComputeEmbedding, computeCosineSimilarity } = require('../services/embeddingService');
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. SMART DEDUPLICATION & ALIAS DICTIONARY
// ==========================================
const COMMON_SKILL_ALIASES = {
  "rest api": ["restful api", "restful apis", "rest apis", "rest api", "rest", "restful"],
  "kubernetes": ["k8s", "kubernetes"],
  "tailwind": ["tailwind css", "tailwindcss", "tailwind"],
  "node": ["node.js", "nodejs", "node"],
  "react": ["react.js", "reactjs", "react"],
  "mongo": ["mongodb", "mongodb atlas", "mongo"],
  "aws": ["amazon web services", "aws"],
  "docker": ["containerization", "containers", "docker"],
  "postgres": ["postgresql", "postgres"],
  "gcp": ["google cloud", "google cloud platform", "gcp"]
};

function normalizeSkillToken(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/s\b/g, '')
    .replace(/ful\b/g, '')
    .trim();
}

function areSkillsEquivalent(skillA, skillB) {
  const normA = normalizeSkillToken(skillA);
  const normB = normalizeSkillToken(skillB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  if (normA.length >= 3 && normB.length >= 3) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }
  return false;
}

function isSkillAlreadyInSkillsSection(skillsObj, newSkill) {
  if (!skillsObj || typeof skillsObj !== 'object') return false;
  for (const itemsText of Object.values(skillsObj)) {
    const tokens = String(itemsText).split(/[,•|;]/).map(t => t.trim()).filter(Boolean);
    for (const token of tokens) {
      if (areSkillsEquivalent(token, newSkill)) return true;
    }
  }
  return false;
}

// ==========================================
// 2. UNIVERSAL DOMAIN AFFINITY CATEGORIZATION
// ==========================================
const DOMAIN_AFFINITIES = [
  {
    terms: ['bls', 'acls', 'rn', 'license', 'cert', 'certified', 'cpa', 'pmp', 'servsafe', 'credential', 'tncc'],
    targetKeywords: ['cert', 'license', 'credential', 'qualification']
  },
  {
    terms: ['pms', 'ehr', 'emr', 'epic', 'cerner', 'opera', 'micros', 'pos', 'system', 'software', 'tool', 'sap', 'amadeus'],
    targetKeywords: ['system', 'software', 'ehr', 'pms', 'tool', 'technolog']
  },
  {
    terms: ['triage', 'patient', 'infusion', 'wound', 'vital', 'catheter', 'cannulation', 'clinical', 'pharmacolog'],
    targetKeywords: ['patient', 'clinical', 'care', 'nursing', 'medical']
  },
  {
    terms: ['guest', 'front desk', 'concierge', 'check-in', 'room allocation', 'housekeeping', 'hospitality'],
    targetKeywords: ['front', 'guest', 'operation', 'hospitality', 'service']
  },
  {
    terms: ['banquet', 'beverage', 'catering', 'menu', 'dining', 'culinary', 'kitchen', 'food'],
    targetKeywords: ['beverage', 'food', 'dining', 'catering', 'f&b']
  },
  {
    terms: ['cloud', 'devops', 'docker', 'kubernetes', 'k8s', 'aws', 'ci/cd', 'linux', 'azure'],
    targetKeywords: ['cloud', 'devops', 'infra', 'platform']
  },
  {
    terms: ['node', 'api', 'kafka', 'express', 'backend', 'java', 'python', 'server', 'rest'],
    targetKeywords: ['backend', 'api', 'server', 'language']
  },
  {
    terms: ['react', 'vue', 'angular', 'frontend', 'ui', 'css', 'tailwind', 'html'],
    targetKeywords: ['frontend', 'ui', 'web', 'design']
  },
  {
    terms: ['mongodb', 'sql', 'mysql', 'postgres', 'redis', 'database', 'testing', 'jest'],
    targetKeywords: ['database', 'data', 'testing', 'qa']
  }
];

function injectOnlyMissingSkillsUniversally(skillsObj, keywords) {
  if (!skillsObj || typeof skillsObj !== 'object') skillsObj = {};
  const categories = Object.keys(skillsObj);
  if (categories.length === 0) {
    skillsObj['Skills'] = (keywords || []).join(', ');
    return skillsObj;
  }

  const list = Array.isArray(keywords) ? keywords : [keywords];

  list.forEach(rawKw => {
    const kw = String(rawKw || '').trim();
    if (!kw) return;

    if (isSkillAlreadyInSkillsSection(skillsObj, kw)) {
      return;
    }

    const lowerKw = kw.toLowerCase();
    let targetCat = null;
    let bestScore = -1;

    for (const cat of categories) {
      const catLower = cat.toLowerCase();
      let score = 0;

      for (const affinity of DOMAIN_AFFINITIES) {
        const matchesAffinityTerm = affinity.terms.some(t => lowerKw.includes(t) || t.includes(lowerKw));
        const matchesCategoryName = affinity.targetKeywords.some(t => catLower.includes(t));
        if (matchesAffinityTerm && matchesCategoryName) {
          score += 10;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        targetCat = cat;
      }
    }

    if (!targetCat || bestScore <= 0) {
      targetCat = categories.find(c => /cloud|devops|backend|tools|competenc/i.test(c)) || categories[0];
    }

    const formattedKw = kw.length <= 4 ? kw.toUpperCase() : (kw.charAt(0).toUpperCase() + kw.slice(1));
    const currentVal = skillsObj[targetCat] ? String(skillsObj[targetCat]).trim() : '';
    skillsObj[targetCat] = currentVal ? `${currentVal}, ${formattedKw}` : formattedKw;
  });

  return skillsObj;
}

// ==========================================
// 3. AST TO STRUCTURED TEMPLATE CONVERTER (EXTRACTS PROJECT LINKS)
// ==========================================
function convertParsedResumeToTemplateJson(parsed) {
  if (!parsed) return {};
  if (parsed.name && parsed.experience) return parsed;

  const structured = {
    name: parsed.header?.name || 'Candidate',
    role: parsed.header?.headline || 'Software Developer',
    email: parsed.header?.email || '',
    phone: parsed.header?.phone || '',
    linkedin: '',
    github: '',
    leetcode: '',
    portfolio: '',
    summary: '',
    skills: {},
    experience: [],
    projects: [],
    education: []
  };

  (parsed.header?.links || []).forEach(lk => {
    const url = lk.url || '';
    if (url.includes('linkedin')) structured.linkedin = url;
    else if (url.includes('github')) structured.github = url;
    else if (url.includes('leetcode')) structured.leetcode = url;
    else structured.portfolio = url;
  });

  (parsed.blocks || []).forEach(b => {
    if (b.isSummary) {
      structured.summary = b.text || '';
    } else if (b.isSkills) {
      (b.items || []).forEach(it => {
        structured.skills[it.category || 'Skills'] = it.items;
      });
    } else if (b.isExperience) {
      (b.entries || []).forEach(e => {
        structured.experience.push({
          title: e.title,
          company: e.subtitle,
          date: e.date,
          bullets: e.bullets || []
        });
      });
    } else if (b.isProjects) {
      (b.entries || []).forEach(e => {
        let link = e.link || '';
        let linkLabel = e.linkLabel || e.label || '';

        // 1. Extract from e.links array (from PDF link annotations)
        if (Array.isArray(e.links) && e.links.length > 0) {
          const firstLink = e.links[0];
          link = firstLink.url || firstLink.href || link;
          linkLabel = firstLink.label || linkLabel;
        }

        const rawSubtitle = String(e.subtitle || '');

        // 2. Fallback: check markdown or URL inside subtitle text
        if (!link) {
          const mdMatch = rawSubtitle.match(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/);
          const urlMatch = rawSubtitle.match(/\((https?:\/\/[^\s\)]+)\)/);
          if (mdMatch) {
            linkLabel = mdMatch[1];
            link = mdMatch[2];
          } else if (urlMatch) {
            link = urlMatch[1];
            linkLabel = /github\.com/i.test(link) ? 'GitHub' : 'Live';
          }
        }

        // 3. Infer label based on URL if missing
        if (!linkLabel && link) {
          if (/github\.com/i.test(link)) linkLabel = 'GitHub';
          else if (/leetcode\.com/i.test(link)) linkLabel = 'LeetCode';
          else if (/linkedin\.com/i.test(link)) linkLabel = 'LinkedIn';
          else if (/netlify|vercel|render|live|demo/i.test(link)) linkLabel = 'Live';
          else linkLabel = 'Link';
        }

        // Clean subtitle: remove raw URLs or trailing label badges
        const cleanTechStack = rawSubtitle
          .replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '')
          .replace(/\((https?:\/\/[^\s\)]+)\)/g, '')
          .replace(/\s*\(\s*(GitHub|Live|Demo|Link|Portfolio)\s*\)\s*$/i, '')
          .trim();

        structured.projects.push({
          name: e.title,
          techStack: cleanTechStack,
          links: cleanTechStack,
          link: link,
          linkLabel: linkLabel || (link ? 'Link' : ''),
          date: e.date,
          bullets: e.bullets || []
        });
      });
    } else if (b.isEducation) {
      (b.entries || []).forEach(e => {
        let inst = (e.lines || []).join(', ');
        if (e.metric) inst += ` | ${e.metric}`;
        structured.education.push({
          degree: e.title,
          institution: inst,
          date: e.date
        });
      });
    }
  });

  if (!structured.summary && parsed.text) {
    const lines = parsed.text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 2) {
      structured.summary = lines.slice(1, 4).join(' ');
    }
  }

  return structured;
}

const toTitleCase = (str) => {
  if (!str) return '';
  return str.replace(/\b\w+/g, (word) => {
    const upper = word.toUpperCase();
    if (['AI', 'ML', 'AWS', 'MERN', 'SDE', 'API', 'UI', 'UX', 'IT', 'RN', 'ICU', 'BLS', 'ACLS'].includes(upper)) {
      return upper;
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
};

// ==========================================
// 4. CONTROLLER ACTION HANDLERS
// ==========================================

const handleATSCheck = async (req, res) => {
  try {
    const { jobDescription } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'Resume PDF file is required' });
    }

    const parsedResume = await parseResumeBuffer(req.file.buffer);

    // Passes callGeminiAI and getModel cleanly
    const competencies = await extractJDSkillsUniversal(jobDescription, callGeminiAI, getModel);

    const structuredJSON = convertParsedResumeToTemplateJson(parsedResume);

    const scoreResult = calculateUniversalATSScore(
      structuredJSON,
      competencies
    );

    let semanticSimilarity = 0;
    try {
      const jdVector = await getOrComputeEmbedding(jobDescription, 'job_description');
      const resumeVector = await getOrComputeEmbedding(parsedResume.text, 'resume');
      if (jdVector.length > 0 && resumeVector.length > 0) {
        semanticSimilarity = Math.round(computeCosineSimilarity(jdVector, resumeVector) * 100);
      }
    } catch (err) {
      console.error('Vector similarity error:', err.message);
    }

    const finalMatchScore = Math.min(100, Math.round(
      (scoreResult.matchPercentage * 0.40) +
      (semanticSimilarity * 0.30) +
      (scoreResult.formattingScore * 0.15) +
      (scoreResult.metricPercentage * 0.15)
    ));

    res.json({
      matchScore: finalMatchScore,
      atsScore: finalMatchScore,
      semanticSimilarity,
      keywordMatchScore: scoreResult.matchPercentage,
      formattingScore: scoreResult.formattingScore,
      metricPercentage: scoreResult.metricPercentage,
      strongVerbPercentage: scoreResult.strongVerbPercentage,
      missingKeywords: scoreResult.missingKeywords,
      matchedKeywords: scoreResult.matchedKeywords,
      formattingIssues: [],
      suggestions: [
        'Tailor bullet points with strong action verbs and measurable outcomes.',
        'Incorporate missing industry competencies identified from the job description.',
        'Ensure standard headers (Experience, Education, Competencies/Skills) are clearly structured.'
      ],
      originalResume: parsedResume
    });
  } catch (error) {
    console.error('ATS Check Error:', error);
    res.status(500).json({ error: error.message || 'ATS analysis failed' });
  }
};

const handleOptimizeBullets = async (req, res) => {
  try {
    const { targetRole, approvedKeywords, optimizationMode } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Resume PDF file is required' });
    if (!targetRole || !targetRole.trim()) return res.status(400).json({ error: 'Target role is required' });

    let parsedKeywords = [];
    try { parsedKeywords = approvedKeywords ? JSON.parse(approvedKeywords) : []; } catch (_) {}

    const cleanRole = toTitleCase(targetRole.trim());
    const parsedResume = await parseResumeBuffer(req.file.buffer);
    const bulletMap = createBulletMap(parsedResume);
    const structuredJSON = convertParsedResumeToTemplateJson(parsedResume);

    if (parsedKeywords && parsedKeywords.length > 0) {
      structuredJSON.skills = injectOnlyMissingSkillsUniversally(structuredJSON.skills, parsedKeywords);
    }

    const optimizationResult = await optimizeBulletsWithAI(
      bulletMap,
      `Target Role: ${cleanRole}`,
      parsedKeywords,
      callGeminiAI,
      getModel,
      parsedResume.text
    );

    let optimizedSummary = null;
    try {
      const summaryPrompt = `Write a powerful, concise 3-4 sentence professional summary for a ${cleanRole} position based on this resume text, incorporating these key skills: ${parsedKeywords.join(', ')}.
      RESUME TEXT:
      ${parsedResume.text.substring(0, 3000)}`;
      optimizedSummary = await callGeminiAI(summaryPrompt, 0.2, getModel(), 'Summary Enhancement');
    } catch (_) {}

    res.json({
      originalResume: parsedResume,
      structuredJSON,
      bulletProposals: {
        original: bulletMap.original,
        optimized: optimizationResult.optimized
      },
      optimizedSummary: optimizedSummary || null,
      targetRole: cleanRole
    });
  } catch (error) {
    console.error('Optimize Bullets Error:', error);
    res.status(500).json({ error: error.message || 'Optimization failed' });
  }
};

const handleGenerateFinalPDF = async (req, res) => {
  try {
    const { finalApprovedResumeJson, targetRole, customKeywords } = req.body;

    let resumeData = typeof finalApprovedResumeJson === 'string'
      ? JSON.parse(finalApprovedResumeJson)
      : finalApprovedResumeJson;

    if (!resumeData) {
      return res.status(400).json({ error: 'Final approved resume JSON is required' });
    }

    if (resumeData.blocks && !resumeData.name) {
      resumeData = convertParsedResumeToTemplateJson(resumeData);
    }

    if (targetRole && targetRole.trim()) {
      resumeData.role = toTitleCase(targetRole.trim());
    }

    let keywordsArray = [];
    if (Array.isArray(customKeywords)) {
      keywordsArray = customKeywords;
    } else if (typeof customKeywords === 'string') {
      try { keywordsArray = JSON.parse(customKeywords); } catch (_) { keywordsArray = [customKeywords]; }
    }

    if (keywordsArray && keywordsArray.length > 0) {
      resumeData.skills = injectOnlyMissingSkillsUniversally(resumeData.skills, keywordsArray);
    }

    const candidateName = (resumeData.name || 'Candidate')
      .replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_') || 'Candidate';

    const cleanRole = (targetRole || 'Professional')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('_')
      .slice(0, 30) || 'Professional';

    const cleanFilename = `${candidateName}_${cleanRole}_Optimized_Resume.pdf`;
    const downloadDir = './reports';
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    const filepath = path.join(downloadDir, `Optimized_${Date.now()}.pdf`);

    await renderResumeToPDF(resumeData, filepath);

    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.download(filepath, cleanFilename, (err) => {
      if (err) console.error('Download error:', err);
      fs.unlink(filepath, () => {});
    });
  } catch (error) {
    console.error('Final PDF Generation Error:', error);
    res.status(500).json({ error: error.message || 'PDF generation failed' });
  }
};

const recordAlias = async (req, res) => {
  try {
    const { term, resumePhrase } = req.body;
    if (!term || !resumePhrase) {
      return res.status(400).json({ error: 'Term and resumePhrase are required' });
    }
    await recordUserAlias(req.user.userId, term, resumePhrase);
    res.json({ success: true, message: 'Alias recorded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  handleATSCheck,
  handleAnalyzeAndSuggest: handleATSCheck,
  handleOptimizeBullets,
  handleGenerateFinalPDF,
  recordAlias,
  injectOnlyMissingSkillsUniversally
};