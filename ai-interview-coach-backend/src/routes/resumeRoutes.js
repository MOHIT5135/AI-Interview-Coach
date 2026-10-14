const express = require('express');
const multer = require('multer');
const { checkATS, suggestEdits, downloadOptimizedPDF, finalizePDF } = require('../controllers/resumeController');
const authMiddleware = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
const router = express.Router();

router.post('/check', authMiddleware, upload.single('resume'), checkATS);
router.post('/suggest-edits', authMiddleware, upload.single('resume'), suggestEdits);
router.post('/optimize-pdf', authMiddleware, upload.single('resume'), downloadOptimizedPDF);
router.post('/finalize-pdf', authMiddleware, finalizePDF);

module.exports = router;
