const InterviewSession = require('../models/InterviewSession');
const QuestionAnswer = require('../models/QuestionAnswer');
const { generateFirstQuestion, evaluateAndNext, generateSummary, summarizeResume } = require('../services/aiService');
const { parsePdfBuffer } = require('../utils/pdfUtils');

const startInterview = async (req, res) => {
  try {
    const { role, difficulty } = req.body;
    if (!role || !difficulty) {
      return res.status(400).json({ error: 'Role and difficulty are required' });
    }

    let resumeText = '';
    let resumeSummary = '';
    if (req.file) {
      resumeText = await parsePdfBuffer(req.file.buffer);
      console.log(`PDF parsed successfully: ${resumeText.length} characters`);
      resumeSummary = await summarizeResume(resumeText);
      console.log(`Resume summarized: ${resumeSummary.length} characters`);
    }

    // Clean up any previous abandoned/incomplete sessions for this user
    const abandonedSessions = await InterviewSession.find({
      userId: req.user.userId,
      status: 'in_progress',
    });
    if (abandonedSessions.length > 0) {
      const abandonedIds = abandonedSessions.map((s) => s._id);
      await QuestionAnswer.deleteMany({ sessionId: { $in: abandonedIds } });
      await InterviewSession.deleteMany({ _id: { $in: abandonedIds } });
    }

    const session = await InterviewSession.create({
      userId: req.user.userId,
      role,
      difficulty,
      status: 'in_progress',
      totalQuestions: 5,
      questionsAnswered: 0,
      resumeText: resumeText || '',
      resumeSummary: resumeSummary || '',
    });

    const firstQuestion = await generateFirstQuestion(role, difficulty, resumeSummary);

    res.status(201).json({
      sessionId: session._id,
      questionNumber: 1,
      totalQuestions: 5,
      question: firstQuestion,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const submitAnswer = async (req, res) => {
  try {
    const { sessionId, answer, questionNumber, currentQuestion } = req.body;
    if (!sessionId || !answer || !questionNumber || !currentQuestion) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const session = await InterviewSession.findOne({ _id: sessionId, userId: req.user.userId });
    if (!session || session.status !== 'in_progress') {
      return res.status(404).json({ error: 'Active interview session not found' });
    }

    // Evaluate answer and get next question (with resume summary context)
    const evaluation = await evaluateAndNext(
      session.role,
      session.difficulty,
      currentQuestion,
      answer,
      questionNumber,
      session.totalQuestions,
      session.resumeSummary || ''
    );

    // Save Q&A record
    await QuestionAnswer.create({
      sessionId: session._id,
      userId: req.user.userId,
      questionNumber,
      question: currentQuestion,
      userAnswer: answer,
      score: evaluation.score,
      goodPoints: evaluation.goodPoints,
      missingPoints: evaluation.missingPoints,
      idealAnswerHint: evaluation.idealAnswerHint,
    });

    session.questionsAnswered = questionNumber;
    await session.save();

    // Check if interview is complete
    if (questionNumber >= session.totalQuestions || !evaluation.nextQuestion) {
      session.status = 'completed';
      session.completedAt = new Date();

      // Fetch all QA pairs for summary
      const allQA = await QuestionAnswer.find({ sessionId: session._id });
      const summaryResult = await generateSummary(session.role, session.difficulty, allQA);

      session.overallScore = summaryResult.overallScore;
      session.strengths = summaryResult.strengths;
      session.weaknesses = summaryResult.weaknesses;
      session.summary = summaryResult.summary;
      await session.save();

      return res.json({
        completed: true,
        sessionId: session._id,
        feedback: evaluation,
        summary: summaryResult,
      });
    }

    res.json({
      completed: false,
      feedback: evaluation,
      nextQuestion: evaluation.nextQuestion,
      questionNumber: questionNumber + 1,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await InterviewSession.findOne({ _id: sessionId, userId: req.user.userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const qaPairs = await QuestionAnswer.find({ sessionId: session._id }).sort({ questionNumber: 1 });

    res.json({ session, qaPairs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const abandonInterview = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await InterviewSession.findOne({ _id: sessionId, userId: req.user.userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'in_progress') {
      await QuestionAnswer.deleteMany({ sessionId: session._id });
      await InterviewSession.deleteOne({ _id: session._id });
    }

    res.json({ message: 'Session abandoned and cleaned up' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { startInterview, submitAnswer, getSession, abandonInterview };
