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
    let plannedTopics = [
      'React Component Design',
      'API Integration & Async Operations',
      'Frontend State Management',
      'UI Performance & Optimization',
      'Version Control & Collaboration'
    ];

    if (req.file) {
      try {
        resumeText = await parsePdfBuffer(req.file.buffer);
        console.log(`PDF parsed successfully: ${resumeText.length} characters`);
        const resData = await summarizeResume(resumeText, role, difficulty);
        resumeSummary = resData.summary;
        plannedTopics = resData.topics;
        console.log(`Resume summarized: ${resumeSummary.length} characters | Planned Topics:`, plannedTopics);
      } catch (sumErr) {
        console.error('Resume summarization failed, falling back to raw text:', sumErr.message);
        resumeSummary = resumeText.substring(0, 1500);
      }
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
      plannedTopics: plannedTopics,
    });

    const firstQuestion = await generateFirstQuestion(role, difficulty, resumeSummary, plannedTopics[0]);

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

    const trimmedAnswer = String(answer || '').trim();
    const wordCount = trimmedAnswer.split(/\s+/).filter(Boolean).length;
    const qWords = new Set(currentQuestion.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/));
    const aWords = trimmedAnswer.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/);
    const overlapCount = aWords.filter(w => qWords.has(w)).length;
    const isCopied = aWords.length > 0 && (overlapCount / aWords.length > 0.7);

    let evaluation;
    const nextTopic = session.plannedTopics && session.plannedTopics[questionNumber] ? session.plannedTopics[questionNumber] : 'General Technical Follow-up';

    if (wordCount < 4 || isCopied) {
      evaluation = {
        score: 1,
        topic: currentQuestion.split('?')[0].slice(0, 40),
        goodPoints: [],
        missingPoints: ['Question was not answered or answer was just copied text.'],
        idealAnswerHint: 'Provide a complete technical explanation addressing the core question requirements.',
        nextQuestion: questionNumber < session.totalQuestions ? (session.plannedTopics[questionNumber] || 'Next technical topic') : null
      };

      await QuestionAnswer.create({
        sessionId: session._id,
        userId: req.user.userId,
        questionNumber,
        question: currentQuestion,
        topic: evaluation.topic,
        userAnswer: answer,
        score: 1,
        goodPoints: [],
        missingPoints: ['Not answered or copied text.'],
        idealAnswerHint: evaluation.idealAnswerHint,
      });
    } else {
      evaluation = await evaluateAndNext(
        session.role,
        session.difficulty,
        currentQuestion,
        answer,
        questionNumber,
        session.totalQuestions,
        session.resumeSummary || '',
        nextTopic
      );

      await QuestionAnswer.create({
        sessionId: session._id,
        userId: req.user.userId,
        questionNumber,
        question: currentQuestion,
        topic: evaluation.topic || currentQuestion.split('?')[0].slice(0, 40),
        userAnswer: answer,
        score: evaluation.score,
        goodPoints: evaluation.goodPoints,
        missingPoints: evaluation.missingPoints,
        idealAnswerHint: evaluation.idealAnswerHint,
      });
    }

    session.questionsAnswered = questionNumber;
    await session.save();

    // Check if interview is complete
    if (questionNumber >= session.totalQuestions || !evaluation.nextQuestion) {
      session.status = 'completed';
      session.completedAt = new Date();

      const allQA = await QuestionAnswer.find({ sessionId: session._id }).sort({ questionNumber: 1 });
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
