const { checkResumeATS, suggestResumeEdits, optimizeResumeToJSON } = require('../services/aiService');
const { parsePdfBuffer } = require('../utils/pdfUtils');
const { renderResumeToPDF } = require('../services/puppeteerService');
const fs = require('fs');
const path = require('path');

const checkATS = async (req, res) => {
  try {
    const { jobDescription } = req.body;
    if (!jobDescription || !req.file) {
      return res.status(400).json({ error: 'Resume file and Job Description are required' });
    }

    const resumeText = await parsePdfBuffer(req.file.buffer);
    if (!resumeText) {
      return res.status(400).json({ error: 'Could not parse resume text' });
    }

    const analysis = await checkResumeATS(resumeText, jobDescription);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const suggestEdits = async (req, res) => {
  try {
    const { targetRole, atsFindings } = req.body;
    if (!targetRole || !req.file) {
      return res.status(400).json({ error: 'Resume file and target role are required' });
    }

    const resumeText = await parsePdfBuffer(req.file.buffer);
    if (!resumeText) {
      return res.status(400).json({ error: 'Could not parse resume text' });
    }

    const suggestions = await suggestResumeEdits(resumeText, targetRole, atsFindings ? JSON.parse(atsFindings) : null);
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const downloadOptimizedPDF = async (req, res) => {
  try {
    const { targetRole, suggestions } = req.body;
    if (!targetRole || !req.file) {
      return res.status(400).json({ error: 'Resume file and target role are required' });
    }

    const resumeText = await parsePdfBuffer(req.file.buffer);
    if (!resumeText) {
      return res.status(400).json({ error: 'Could not parse resume text' });
    }

    const parsedSuggestions = suggestions ? JSON.parse(suggestions) : [];
    const resumeData = await optimizeResumeToJSON(resumeText, targetRole, parsedSuggestions);

    const downloadDir = './reports';
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    const filename = `Optimized_Resume_${Date.now()}.pdf`;
    const filepath = path.join(downloadDir, filename);

    await renderResumeToPDF(resumeData, filepath);

    res.download(filepath, `Optimized_Resume_${targetRole.replace(/\s+/g, '_')}.pdf`, (err) => {
      if (err) console.error('Error downloading optimized resume:', err);
      fs.unlink(filepath, (err) => { if (err) console.error('Failed to unlink: ', err); });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const finalizePDF = async (req, res) => {
  try {
    const { resumeData, targetRole } = req.body;
    const downloadDir = './reports';
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    const filename = `Optimized_Resume_${Date.now()}.pdf`;
    const filepath = path.join(downloadDir, filename);

    await renderResumeToPDF(JSON.parse(resumeData), filepath);

    res.download(filepath, `Optimized_Resume_${targetRole.replace(/\s+/g, '_')}.pdf`, (err) => {
        if (err) console.error('Error downloading optimized resume:', err);
        fs.unlink(filepath, (err) => { if(err) console.error('Failed to unlink: ', err); });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { checkATS, suggestEdits, downloadOptimizedPDF, finalizePDF };
