'use strict';
const { parseResumeBuffer } = require('./resumeParser');
const { createBulletMap, optimizeBulletsWithAI, optimizeSummaryWithAI } = require('./aiEditor');
const { extractJDSkillsUniversal, calculateUniversalATSScore } = require('./atsEvaluator');
const AtsCache = require('../models/AtsCache');
const crypto = require('crypto');

// Converts parser AST into template-ready JSON
const convertParsedResumeToTemplateJson = (parsedResume, summaryText = '') => {
  const header = parsedResume.header || {};
  const linksObj = {};

  (header.links || []).forEach((lk) => {
    const url = lk.url || '';
    const lab = (lk.label || '').toLowerCase();
    const uLower = url.toLowerCase();
    if (uLower.includes('linkedin') || lab.includes('linkedin')) linksObj.linkedin = url;
    else if (uLower.includes('github') || lab.includes('github')) linksObj.github = url;
    else if (uLower.includes('leetcode') || lab.includes('leetcode')) linksObj.leetcode = url;
    else if (uLower.includes('portfolio') || lab.includes('portfolio') || uLower.includes('netlify.app') || uLower.includes('vercel.app')) linksObj.portfolio = url;
  });

  // Regex fallback: guarantees links are captured even if annotations were stripped
  const rawText = parsedResume.text || '';
  if (!linksObj.linkedin) {
    const m = rawText.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i);
    if (m) linksObj.linkedin = m[0];
  }
  if (!linksObj.github) {
    const m = rawText.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+\/?/i);
    if (m) linksObj.github = m[0];
  }
  if (!linksObj.leetcode) {
    const m = rawText.match(/https?:\/\/(?:www\.)?leetcode\.com\/(?:u\/)?[a-zA-Z0-9_-]+\/?/i);
    if (m) linksObj.leetcode = m[0];
  }
  if (!linksObj.portfolio) {
    const m = rawText.match(/https?:\/\/[a-zA-Z0-9_.-]+\.(?:netlify\.app|vercel\.app|github\.io|me|dev)\/?/i);
    if (m) linksObj.portfolio = m[0];
  }

  const structured = {
    name: header.name || parsedResume.name || 'Candidate',
    role: header.headline || parsedResume.role || 'Software Developer',
    email: header.email || parsedResume.email || '',
    phone: header.phone || parsedResume.phone || '',
    linkedin: linksObj.linkedin || '',
    github: linksObj.github || '',
    leetcode: linksObj.leetcode || '',
    portfolio: linksObj.portfolio || '',
    summary: summaryText,
    skills: {},
    experience: [],
    projects: [],
    education: []
  };

  (parsedResume.blocks || []).forEach((b) => {
    if (b.isSkills) {
      (b.items || []).forEach((it) => {
        structured.skills[it.category || 'Skills'] = it.items;
      });
    } else if (b.isExperience) {
      (b.entries || []).forEach((e) => {
        structured.experience.push({
          title: e.title || '',
          company: e.subtitle || '',
          date: e.date || '',
          bullets: Array.isArray(e.bullets) ? e.bullets : []
        });
      });
    } else if (b.isProjects) {
      (b.entries || []).forEach((e) => {
        const linkObj = (e.links && e.links.length > 0) ? e.links[0] : null;
        structured.projects.push({
          name: e.title || '',
          link: linkObj ? linkObj.url : '',
          linkLabel: linkObj ? (linkObj.label || 'Link') : '',
          techStack: e.subtitle || '',
          date: e.date || '',
          bullets: Array.isArray(e.bullets) ? e.bullets : []
        });
      });
    } else if (b.isEducation) {
      (b.entries || []).forEach((e) => {
        let inst = (e.lines || []).join(', ');
        structured.education.push({
          degree: e.title || '',
          institution: inst,
          metric: e.metric || '',
          date: e.date || ''
        });
      });
    }
  });

  return structured;
};

// STEP 1 ONLY: ATS Scoring (Single API Call: Competency Extraction)
const runATSCheck = async (pdfBuffer, rawJobDescription, callOpenRouterFn, getModelFn) => {
  const parsedResume = await parseResumeBuffer(pdfBuffer);
  if (!parsedResume.ok) {
    throw new Error(`Failed to parse resume PDF: ${parsedResume.reason}`);
  }

  const experienceBlocks = [];
  const projectBlocks = [];
  let skillsText = '';
  let summaryText = '';

  (parsedResume.blocks || []).forEach((block) => {
    if (block.isSummary) {
      summaryText = block.text || '';
    } else if (block.isSkills) {
      skillsText = (block.items || []).map((i) => `${i.category}: ${i.items}`).join(' ');
    } else if (block.isExperience) {
      (block.entries || []).forEach((e) => {
        experienceBlocks.push(`${e.title} ${e.subtitle} ${(e.bullets || []).join(' ')}`);
      });
    } else if (block.isProjects) {
      (block.entries || []).forEach((e) => {
        projectBlocks.push(`${e.title} ${e.subtitle} ${(e.bullets || []).join(' ')}`);
      });
    }
  });

  const jdHash = crypto.createHash('sha256').update(String(rawJobDescription || '').trim().toLowerCase()).digest('hex');
  let competencies = [];

  try {
    const cached = await AtsCache.findOne({ jdHash });
    if (cached && Array.isArray(cached.parsedData)) competencies = cached.parsedData;
  } catch (_) {}

  if (!competencies || competencies.length === 0) {
    competencies = await extractJDSkillsUniversal(rawJobDescription, callOpenRouterFn, getModelFn);
    if (competencies.length > 0) {
      AtsCache.create({ jdHash, parsedData: competencies }).catch(() => {});
    }
  }

  const scoreResult = calculateUniversalATSScore(
    {
      summary: summaryText || parsedResume.text,
      skills: skillsText,
      experience: experienceBlocks,
      projects: projectBlocks
    },
    competencies
  );

  const structuredJSON = convertParsedResumeToTemplateJson(parsedResume, summaryText);

  return {
    initialScore: scoreResult.matchPercentage,
    matchedKeywords: scoreResult.matchedKeywords,
    missingKeywords: scoreResult.missingKeywords,
    originalResume: {
      ...parsedResume,
      structuredJSON
    }
  };
};

// STEP 2 ONLY: AI Bullet Optimization (Called ONLY from Optimizer Page)
const runBulletOptimization = async (pdfBuffer, targetRole, approvedKeywords = [], optimizationMode = 'both', callOpenRouterFn, getModelFn) => {
  const parsedResume = await parseResumeBuffer(pdfBuffer);
  if (!parsedResume.ok) {
    throw new Error(`Failed to parse resume PDF: ${parsedResume.reason}`);
  }

  const bulletMap = createBulletMap(parsedResume);

  const summaryBlock = (parsedResume.blocks || []).find(b => b.isSummary);
  const originalSummary = summaryBlock ? summaryBlock.text : '';

  // Generate structuredJSON for PDF compilation
  const structuredJSON = convertParsedResumeToTemplateJson(parsedResume, originalSummary);

  const [optimizationResult, optimizedSummary] = await Promise.all([
    optimizeBulletsWithAI(
      bulletMap,
      targetRole,
      approvedKeywords,
      optimizationMode,
      callOpenRouterFn,
      getModelFn,
      parsedResume.text,
      approvedKeywords
    ),
    optimizeSummaryWithAI(
      originalSummary,
      targetRole,
      approvedKeywords,
      callOpenRouterFn,
      getModelFn
    )
  ]);

  return {
    originalResume: {
      ...parsedResume,
      structuredJSON
    },
    structuredJSON,
    bulletProposals: {
      original: bulletMap.original,
      optimized: optimizationResult.optimized,
      rejected: optimizationResult.rejected || {}
    },
    optimizedSummary
  };
};

module.exports = { runATSCheck, runBulletOptimization, convertParsedResumeToTemplateJson };