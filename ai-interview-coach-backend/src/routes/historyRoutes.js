const express = require('express');
const { getHistory, deleteSession } = require('../controllers/historyController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, getHistory);
router.delete('/:sessionId', authMiddleware, deleteSession);

module.exports = router;
