const InterviewSession = require('../models/InterviewSession');
const QuestionAnswer = require('../models/QuestionAnswer');

const getHistory = async (req, res) => {
  try {
    const sessions = await InterviewSession.find({ userId: req.user.userId, status: 'completed' })
      .sort({ createdAt: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await InterviewSession.findOneAndDelete({ _id: sessionId, userId: req.user.userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    // Cascade delete all associated question answers
    await QuestionAnswer.deleteMany({ sessionId });
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getHistory, deleteSession };
