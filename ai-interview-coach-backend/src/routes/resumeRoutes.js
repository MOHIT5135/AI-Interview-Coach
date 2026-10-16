const express = require('express');
const multer = require('multer');

const {
  handleAnalyzeAndSuggest,
  handleGenerateFinalPDF,
  recordAlias
} = require('../controllers/resumeController');

const authMiddleware = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
const router = express.Router();

// ATS Check & Suggestion Endpoints (supporting both /check and /analyze-and-suggest)
router.post('/check', authMiddleware, upload.single('resume'), handleAnalyzeAndSuggest);
router.post('/analyze-and-suggest', authMiddleware, upload.single('resume'), handleAnalyzeAndSuggest);

// Final PDF Generation
router.post('/generate-final-pdf', authMiddleware, handleGenerateFinalPDF);

// Keep alias learner for user-specific tech acronyms
router.post('/alias', authMiddleware, recordAlias);

module.exports = router;
