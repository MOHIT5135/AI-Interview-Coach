const express = require('express');
const multer = require('multer');
const { startInterview, submitAnswer, getSession, abandonInterview } = require('../controllers/interviewController');
const authMiddleware = require('../middleware/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.post('/start', authMiddleware, upload.single('resume'), startInterview);
router.post('/answer', authMiddleware, submitAnswer);
router.get('/session/:sessionId', authMiddleware, getSession);
router.delete('/session/:sessionId/abandon', authMiddleware, abandonInterview);

module.exports = router;
