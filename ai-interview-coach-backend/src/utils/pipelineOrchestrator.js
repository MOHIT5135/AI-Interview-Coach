'use strict';
const { parseResumeBuffer } = require('./resumeParser');
const { createBulletMap, optimizeBulletsWithAI, reconstructStructuredJSON } = require('./aiEditor');
const { extractJDSkillsUniversal, calculateUniversalATSScore } = require('./atsEvaluator');
const { callGeminiAI, getModel: defaultGetModel } = require('../services/aiService');
const AtsCache = require('../models/AtsCache');
const crypto = require('crypto');

const runVerifiedPipeline = async (
  pdfBuffer,
  rawJobDescription,
  approvedKeywords = [],
  optimizationMode = 'both',
  knownMissingKeywords = [],
  callAiFn = callGeminiAI,
  getModelFn = defaultGetModel
) => {
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

  let missingKeywords = knownMissingKeywords || [];
  let matchedKeywords = [];
  let initialScore = 0;

  if (missingKeywords.length === 0 && (!approvedKeywords || approvedKeywords.length === 0)) {
    // 0-Token Caching via MongoDB AtsCache
    const jdHash = crypto.createHash('sha256').update(String(rawJobDescription || '').trim().toLowerCase()).digest('hex');
    let competencies = [];

    try {
      const cached = await AtsCache.findOne({ jdHash });
      if (cached && Array.isArray(cached.parsedData) && cached.parsedData.length > 0) {
        competencies = cached.parsedData;
      }
    } catch (_) {}

    if (!competencies || competencies.length === 0) {
      competencies = await extractJDSkillsUniversal(rawJobDescription, callAiFn, getModelFn);
      if (competencies.length > 0) {
        try {
          await AtsCache.create({ jdHash, parsedData: competencies });
        } catch (_) {}
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
    missingKeywords = scoreResult.missingKeywords;
    matchedKeywords = scoreResult.matchedKeywords;
    initialScore = scoreResult.matchPercentage;
  }

  const bulletMap = createBulletMap(parsedResume);
  const optimizationResult = await optimizeBulletsWithAI(
    bulletMap,
    rawJobDescription,
    approvedKeywords.length > 0 ? approvedKeywords : missingKeywords,
    callAiFn,
    getModelFn,
    parsedResume.text
  );

  const structuredJSON = {
    name: parsedResume.header?.name || 'Candidate',
    role: parsedResume.header?.headline || 'Software Developer',
    email: parsedResume.header?.email || '',
    phone: parsedResume.header?.phone || '',
    summary: summaryText,
    skills: {},
    experience: [],
    projects: [],
    education: []
  };

  (parsedResume.header?.links || []).forEach((lk) => {
    const url = lk.url || '';
    if (url.includes('linkedin')) structuredJSON.linkedin = url;
    else if (url.includes('github')) structuredJSON.github = url;
    else if (url.includes('leetcode')) structuredJSON.leetcode = url;
    else structuredJSON.portfolio = url;
  });

  (parsedResume.blocks || []).forEach((b) => {
    if (b.isSkills) {
      (b.items || []).forEach((it) => {
        structuredJSON.skills[it.category || 'Technical Skills'] = it.items;
      });
    } else if (b.isExperience) {
      (b.entries || []).forEach((e) => {
        structuredJSON.experience.push({
          title: e.title,
          company: e.subtitle,
          date: e.date,
          bullets: e.bullets || []
        });
      });
    } else if (b.isProjects) {
      (b.entries || []).forEach((e) => {
        structuredJSON.projects.push({
          name: e.title,
          links: e.subtitle,
          date: e.date,
          bullets: e.bullets || []
        });
      });
    } else if (b.isEducation) {
      (b.entries || []).forEach((e) => {
        let inst = (e.lines || []).join(', ');
        if (e.metric) inst += ` | ${e.metric}`;
        structuredJSON.education.push({
          degree: e.title,
          institution: inst,
          date: e.date
        });
      });
    }
  });

  return {
    initialScore,
    matchedKeywords,
    missingKeywords,
    originalResume: {
      ...parsedResume,
      structuredJSON
    },
    bulletProposals: {
      original: bulletMap.original,
      optimized: optimizationResult.optimized,
      rejected: optimizationResult.rejected || {}
    }
  };
};

module.exports = { runVerifiedPipeline, reconstructStructuredJSON };