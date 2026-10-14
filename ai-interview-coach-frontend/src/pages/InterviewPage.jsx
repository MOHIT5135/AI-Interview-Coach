import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { Send, CheckCircle2, AlertCircle, ArrowRight, Loader2, Award, XCircle } from 'lucide-react';

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

  useEffect(() => {
    if (initialSessionData) return;

    const startSession = async () => {
      try {
        const token = JSON.parse(localStorage.getItem('userInfo'))?.token;
        const formData = new FormData();
        formData.append('role', role);
        formData.append('difficulty', difficulty);

        const res = await fetch('http://localhost:5000/api/interview/start', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start');

        setSessionId(data.sessionId);
        setCurrentQuestion(data.question || 'Could not load question.');
        setQuestionNumber(data.questionNumber || 1);
        setTotalQuestions(data.totalQuestions || 5);
      } catch (err) {
        console.error('Failed to start interview:', err);
        setCurrentQuestion('Error connecting to AI interviewer. Please check backend.');
      } finally {
        setLoading(false);
      }
    };
    startSession();
  }, [role, difficulty, initialSessionData]);

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!answer.trim()) return;

    setSubmitting(true);
    try {
      const token = JSON.parse(localStorage.getItem('userInfo'))?.token;
      const res = await fetch('http://localhost:5000/api/interview/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          answer,
          questionNumber,
          currentQuestion,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit answer');

      setFeedback(data.feedback);

      if (data.completed) {
        setTimeout(() => {
          navigate(`/summary/${sessionId}`);
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    setFeedback(null);
    setAnswer('');
    setCurrentQuestion(feedback.nextQuestion);
    setQuestionNumber((prev) => prev + 1);
  };

  const handleQuit = async () => {
    if (!window.confirm('Are you sure you want to quit? This unfinished session will be discarded.')) {
      return;
    }

    try {
      if (sessionId) {
        const token = JSON.parse(localStorage.getItem('userInfo'))?.token;
        await fetch(`http://localhost:5000/api/interview/session/${sessionId}/abandon`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.error('Failed to clean up abandoned session:', err);
    }
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors duration-200">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
          <p className="text-gray-600 dark:text-gray-300 font-medium">Generating your first interview question...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col transition-colors duration-200">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full flex flex-col">
        {/* Progress bar & Quit Action */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{role} ({difficulty})</span>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-3">Question {questionNumber} of {totalQuestions}</span>
            </div>
            <button
              onClick={handleQuit}
              className="flex items-center space-x-1.5 text-xs sm:text-sm font-semibold text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-red-200 dark:hover:border-red-900/50 bg-white dark:bg-gray-900 transition cursor-pointer"
            >
              <XCircle className="h-4 w-4" />
              <span>Quit Interview</span>
            </button>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6 transition-colors duration-200">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Interviewer Question</h3>
          <p className="text-lg text-gray-700 dark:text-gray-200 leading-relaxed font-medium">
            {currentQuestion || "Loading question..."}
          </p>
        </div>

        {/* Feedback Panel (Shows after submitting) */}
        {feedback ? (
          <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6 space-y-6 transition-colors duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <h4 className="font-bold text-gray-900 dark:text-white text-lg">Answer Feedback</h4>
              <div className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-xl font-bold text-lg border border-indigo-100 dark:border-indigo-800">
                <Award className="h-5 w-5" />
                <span>Score: {feedback.score} / 10</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center space-x-2 mb-3">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>What You Did Well</span>
                </h5>
                <ul className="space-y-2">
                  {feedback.goodPoints?.map((point, index) => (
                    <li key={index} className="text-sm text-gray-600 dark:text-gray-300 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                      • {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h5 className="font-bold text-amber-700 dark:text-amber-400 flex items-center space-x-2 mb-3">
                  <AlertCircle className="h-5 w-5" />
                  <span>Missing Points / Gaps</span>
                </h5>
                <ul className="space-y-2">
                  {feedback.missingPoints && feedback.missingPoints.length > 0 ? (
                    feedback.missingPoints.map((point, index) => (
                      <li key={index} className="text-sm text-gray-600 dark:text-gray-300 bg-amber-50/50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-100 dark:border-amber-900/40">
                        • {point}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                      None! Excellent, comprehensive answer.
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
              <h5 className="font-bold text-indigo-900 dark:text-indigo-300 mb-1">Ideal Answer Hint</h5>
              <p className="text-sm text-indigo-700 dark:text-indigo-400">{feedback.idealAnswerHint}</p>
            </div>

            <div className="flex justify-end pt-4">
              {feedback.nextQuestion ? (
                <button
                  onClick={handleNextQuestion}
                  className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow transition cursor-pointer"
                >
                  <span>Next Question</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              ) : (
                <div className="text-indigo-600 dark:text-indigo-400 font-bold animate-pulse">
                  Interview completed! Redirecting to summary...
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Answer Form */
          <form onSubmit={handleSubmitAnswer} className="flex flex-col flex-1">
            <div className="flex-1 mb-4">
              <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Your Answer</label>
              <textarea
                rows={6}
                required
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your detailed answer here..."
                className="w-full p-4 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white bg-white dark:bg-gray-900 text-base"
              ></textarea>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !answer.trim()}
                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-semibold px-8 py-4 rounded-xl shadow transition text-lg cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Evaluating with AI...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Answer</span>
                    <Send className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default InterviewPage;
