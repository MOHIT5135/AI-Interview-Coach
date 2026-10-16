const { parseResumeBuffer } = require('./resumeParser');
const { createBulletMap, optimizeBulletsWithAI, reconstructStructuredJSON } = require('./aiEditor');
const { extractJDSkillsUniversal, calculateUniversalATSScore } = require('./atsEvaluator');

const runVerifiedPipeline = async (pdfBuffer, rawJobDescription, approvedKeywords, optimizationMode, knownMissingKeywords, callOpenRouterFn, getModelFn) => {
  const parsedResume = await parseResumeBuffer(pdfBuffer);
  if (!parsedResume.ok) {
    throw new Error(`Failed to parse resume PDF: ${parsedResume.reason}`);
  }

  // Extract clean structured sections for ATS scoring
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
    const competencies = await extractJDSkillsUniversal(rawJobDescription, callOpenRouterFn, getModelFn);
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
    approvedKeywords || missingKeywords,
    callOpenRouterFn,
    getModelFn,
    parsedResume.text
  );

  return {
    initialScore,
    matchedKeywords,
    missingKeywords,
    originalResume: parsedResume,
    bulletProposals: {
      original: bulletMap.original,
      optimized: optimizationResult.optimized
    }
  };
};

module.exports = { runVerifiedPipeline, reconstructStructuredJSON };
