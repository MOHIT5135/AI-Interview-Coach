'use strict';
const express = require('express');
const multer = require('multer');
const {
  handleATSCheck,
  handleOptimizeBullets,
  handleGenerateFinalPDF,
  recordAlias
} = require('../controllers/resumeController');
const authMiddleware = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});
const router = express.Router();

// ATS Check ONLY
router.post('/check', authMiddleware, upload.single('resume'), handleATSCheck);
router.post('/ats-check', authMiddleware, upload.single('resume'), handleATSCheck);
router.post('/analyze-and-suggest', authMiddleware, upload.single('resume'), handleATSCheck);

// Optimization ONLY
router.post('/optimize', authMiddleware, upload.single('resume'), handleOptimizeBullets);
router.post('/suggest-edits', authMiddleware, upload.single('resume'), handleOptimizeBullets);

// Export & Alias
router.post('/generate-final-pdf', authMiddleware, handleGenerateFinalPDF);
router.post('/download-pdf', authMiddleware, handleGenerateFinalPDF);
router.post('/alias', authMiddleware, recordAlias);

module.exports = router;