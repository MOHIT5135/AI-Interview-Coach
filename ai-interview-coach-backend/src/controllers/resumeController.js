const { recordUserAlias } = require('../services/aiService');
const { runVerifiedPipeline } = require('../utils/pipelineOrchestrator');
const { renderResumeToPDF } = require('../services/puppeteerService');
const { mapFlatArrayToNestedObjects, mapProjectsFlatArrayToNested } = require('../utils/structuralMapper');
const fs = require('fs');
const path = require('path');

// ==========================================
// STEP 1: Analyze & Suggest
// ==========================================
const handleAnalyzeAndSuggest = async (req, res) => {
  try {
    const { jobDescription, approvedKeywords, optimizationMode, missingKeywords } = req.body;
    let parsedKeywords = [];
    try {
      parsedKeywords = approvedKeywords ? JSON.parse(approvedKeywords) : [];
    } catch (e) {
      parsedKeywords = [];
    }

    let parsedMissingKeywords = [];
    try {
      parsedMissingKeywords = missingKeywords ? JSON.parse(missingKeywords) : [];
    } catch (e) {
      parsedMissingKeywords = [];
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Resume PDF file is required' });
    }

    const { callOpenRouter } = require('../services/aiService');
    const getModel = () => process.env.OPENROUTER_MODEL || 'antigravity/gemini-3-flash';

    // Pass req.file.buffer natively to runVerifiedPipeline
    const result = await runVerifiedPipeline(
      req.file.buffer,
      jobDescription,
      parsedKeywords,
      optimizationMode || 'both',
      parsedMissingKeywords,
      callOpenRouter,
      getModel
    );

    res.json({
      matchScore: result.initialScore,
      atsScore: result.initialScore,
      missingKeywords: result.missingKeywords,
      matchedKeywords: result.matchedKeywords,
      formattingIssues: result.formattingIssues || [],
      suggestions: result.suggestions || [
        'Tailor your resume bullet points with action verbs and quantifiable metrics.',
        'Incorporate missing technical keywords found in the job description.',
        'Ensure standard section headers (Experience, Education, Skills) are clearly marked.'
      ],
      originalResume: result.originalResume,
      bulletProposals: result.bulletProposals
    });

  } catch (error) {
    console.error('Analyze and Suggest Error:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
};

// ==========================================
// STEP 2: Generate Final PDF
// ==========================================
const handleGenerateFinalPDF = async (req, res) => {
  try {
    const { finalApprovedResumeJson, targetRole } = req.body;

    let resumeData = typeof finalApprovedResumeJson === 'string' ? JSON.parse(finalApprovedResumeJson) : finalApprovedResumeJson;

    if (!resumeData) {
      return res.status(400).json({ error: 'Final approved resume JSON is required' });
    }

    // 1. APPLY STRUCTURAL MAPPER before rendering
    if (resumeData.experience) {
      resumeData.experience = mapFlatArrayToNestedObjects(resumeData.experience);
    }
    if (resumeData.projects && Array.isArray(resumeData.projects) && typeof resumeData.projects[0] === 'string') {
      resumeData.projects = mapProjectsFlatArrayToNested(resumeData.projects); // Fixed mapper
    }

    // 2. Format Filename
    const candidateName = (resumeData.name || 'Candidate')
      .replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_') || 'Candidate';

    const roleName = (targetRole || 'Optimized')
      .replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_') || 'Target_Role';

    const cleanFilename = `${candidateName}_${roleName}_Optimized_Resume.pdf`;
    const downloadDir = './reports';
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    const filepath = path.join(downloadDir, `Optimized_${Date.now()}.pdf`);

    // 3. Render PDF
    await renderResumeToPDF(resumeData, filepath);

    // 4. Send to client
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

// ==========================================
// ALIAS RECORDING
// ==========================================
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

module.exports = { handleAnalyzeAndSuggest, handleGenerateFinalPDF, recordAlias };
