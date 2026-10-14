const express = require('express');
const { getStats, getProgress, downloadReport } = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/stats', authMiddleware, getStats);
router.get('/progress', authMiddleware, getProgress);
router.get('/report/:sessionId', authMiddleware, downloadReport);

module.exports = router;
