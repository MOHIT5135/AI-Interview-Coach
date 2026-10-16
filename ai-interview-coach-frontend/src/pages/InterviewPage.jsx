import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { Send, CheckCircle2, AlertCircle, ArrowRight, Loader2, Award, XCircle } from 'lucide-react';
import axiosClient from '../api/axiosClient';

const InterviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, difficulty, initialSessionData } = location.state || {
    role: 'Frontend Developer',
    difficulty: 'Medium',
    initialSessionData: null,
  };

  const [sessionId, setSessionId] = useState(initialSessionData?.sessionId || null);
  const [questionNumber, setQuestionNumber] = useState(initialSessionData?.questionNumber || 1);
  const [totalQuestions, setTotalQuestions] = useState(initialSessionData?.totalQuestions || 5);
  const [currentQuestion, setCurrentQuestion] = useState(initialSessionData?.question || '');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(!initialSessionData);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Sync active sessionId to sessionStorage
  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem('active_interview_session_id', sessionId);
    }
  }, [sessionId]);

  // Session recovery on page reload
  useEffect(() => {
    if (initialSessionData) return;

    const savedSessionId = sessionStorage.getItem('active_interview_session_id');
    if (savedSessionId) {
      axiosClient.get(`/interview/session/${savedSessionId}`).then((res) => {
        const { session, qaPairs } = res.data;
        if (session.status === 'completed') {
          navigate(`/summary/${savedSessionId}`);
          return;
        }
        setSessionId(session._id);
        setQuestionNumber(session.questionsAnswered + 1);
        setTotalQuestions(session.totalQuestions);
        const lastQ = qaPairs && qaPairs.length > 0 ? qaPairs[qaPairs.length - 1] : null;
        setCurrentQuestion(lastQ ? lastQ.question : (session.plannedTopics?.[0] || 'Technical Question'));
        setLoading(false);
      }).catch(() => {
        startSession();
      });
    } else {
      startSession();
    }
  }, []);

  const startSession = async () => {
    try {
      const formData = new FormData();
      formData.append('role', role);
      formData.append('difficulty', difficulty);

      const res = await axiosClient.post('/interview/start', formData);
      const data = res.data;
      setSessionId(data.sessionId);
      setCurrentQuestion(data.question || 'Could not load question.');
      setQuestionNumber(data.questionNumber || 1);
      setTotalQuestions(data.totalQuestions || 5);
    } catch (err) {
      console.error('Failed to start interview:', err);
      setCurrentQuestion('Error connecting to AI interviewer.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!answer.trim()) return;

    setSubmitting(true);
    try {
      const res = await axiosClient.post('/interview/answer', {
        sessionId,
        questionNumber,
        answer: answer.trim(),
        currentQuestion
      });

      const data = res.data;
      setFeedback(data.feedback);

      if (data.completed) {
        sessionStorage.removeItem('active_interview_session_id');
        setTimeout(() => {
          navigate(`/summary/${sessionId}`);
        }, 2500);
      } else {
        setTimeout(() => {
          setCurrentQuestion(data.nextQuestion);
          setQuestionNumber(data.questionNumber);
          setAnswer('');
          setFeedback(null);
        }, 3500);
      }
    } catch (err) {
      console.error('Submit answer error:', err);
      alert('Failed to submit answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuit = async () => {
    if (!window.confirm('Quit interview? Your progress will be discarded.')) return;
    try {
      sessionStorage.removeItem('active_interview_session_id');
      await axiosClient.delete(`/interview/session/${sessionId}/abandon`);
    } catch (_) {}
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors duration-200">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
          <p className="text-gray-600 dark:text-gray-300 font-medium">Loading interview question...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col transition-colors duration-200">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full flex flex-col">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{role} ({difficulty})</span>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-3">Question {questionNumber} of {totalQuestions}</span>
            </div>
            <button
              onClick={handleQuit}
              className="text-sm text-red-600 dark:text-red-400 hover:underline font-semibold cursor-pointer"
            >
              Quit Interview
            </button>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-300"
              style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Question {questionNumber}</h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{currentQuestion}</p>
        </div>

        {feedback ? (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-emerald-200 dark:border-emerald-900 space-y-6 mb-6">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 mr-2" /> Evaluation & Feedback
              </h3>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {feedback.score}/10
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm mb-2 flex items-center">
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> What You Did Well
                </h4>
                <ul className="text-xs space-y-1 text-emerald-900 dark:text-emerald-200 list-disc pl-4">
                  {feedback.goodPoints?.map((gp, i) => <li key={i}>{gp}</li>)}
                </ul>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50">
                <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm mb-2 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1.5" /> Missing / Improvement Areas
                </h4>
                <ul className="text-xs space-y-1 text-amber-900 dark:text-amber-200 list-disc pl-4">
                  {feedback.missingPoints?.map((mp, i) => <li key={i}>{mp}</li>)}
                </ul>
              </div>
            </div>

            {feedback.idealAnswerHint && (
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm mb-1 flex items-center">
                  <Award className="h-4 w-4 mr-1.5 text-indigo-600" /> Ideal Technical Coverage
                </h4>
                <p className="text-xs text-indigo-800 dark:text-indigo-300">{feedback.idealAnswerHint}</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmitAnswer} className="flex-1 flex flex-col">
            <textarea
              className="w-full flex-1 min-h-[220px] p-4 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Type your technical answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />

            <button
              type="submit"
              disabled={submitting || !answer.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Evaluating Response...</span>
                </>
              ) : (
                <>
                  <span>Submit Answer</span>
                  <Send className="h-4 w-4 ml-2" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default InterviewPage;