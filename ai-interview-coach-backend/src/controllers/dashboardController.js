const InterviewSession = require('../models/InterviewSession');
const QuestionAnswer = require('../models/QuestionAnswer');
const { generatePDFReport } = require('../services/reportService');

const getStats = async (req, res) => {
  try {
    const sessions = await InterviewSession.find({ userId: req.user.userId, status: 'completed' });

    const totalInterviews = sessions.length;
    let avgScore = 0;
    if (totalInterviews > 0) {
      const sumScores = sessions.reduce((acc, s) => acc + (s.overallScore || 0), 0);
      avgScore = parseFloat((sumScores / totalInterviews).toFixed(1));
    }

    res.json({
      totalInterviews,
      avgScore,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProgress = async (req, res) => {
  try {
    const sessions = await InterviewSession.find({ userId: req.user.userId, status: 'completed' })
      .sort({ createdAt: 1 });

    const progressData = sessions.map(s => ({
      date: s.createdAt.toISOString().split('T')[0],
      score: s.overallScore,
      role: s.role,
    }));

    res.json(progressData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const downloadReport = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await InterviewSession.findOne({ _id: sessionId, userId: req.user.userId });
    if (!session || session.status !== 'completed') {
      return res.status(404).json({ error: 'Completed session not found' });
    }

    const qaPairs = await QuestionAnswer.find({ sessionId: session._id }).sort({ questionNumber: 1 });

    const filepath = await generatePDFReport(sessionId, session, qaPairs);

    res.download(filepath, `Interview_Report_${session.role}_${session.createdAt.toISOString().split('T')[0]}.pdf`, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getStats, getProgress, downloadReport };
