import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Navbar from '../components/common/Navbar';
import { Trophy, CheckCircle2, AlertCircle, ArrowLeft, Award, BookOpen, Download, Loader2 } from 'lucide-react';

const SessionSummaryPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await axiosClient.get(`/interview/session/${sessionId}`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch session summary:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  const handleDownloadReport = async () => {
    if (!data) return;

    setDownloading(true);
    try {
      const token = JSON.parse(localStorage.getItem('userInfo'))?.token;
      const response = await fetch(`http://localhost:5000/api/dashboard/report/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to download report');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Interview_Report_${data.session.role}_${new Date(data.session.createdAt).toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download report:', err);
      alert('Failed to download PDF report');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors duration-200">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors duration-200">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          Session not found.
        </div>
      </div>
    );
  }

  const { session, qaPairs } = data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col transition-colors duration-200">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full space-y-8">
        {/* Top bar */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {new Date(session.createdAt).toLocaleDateString()}
            </span>
            <button
              onClick={handleDownloadReport}
              disabled={downloading}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-semibold px-4 py-2 rounded-xl shadow transition cursor-pointer"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{downloading ? 'Generating...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>

        {/* Hero Score Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-8 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between">
          <div className="space-y-2 text-center md:text-left mb-6 md:mb-0">
            <span className="bg-indigo-500/50 text-indigo-100 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              {session.role} • {session.difficulty}
            </span>
            <h1 className="text-3xl font-extrabold">Interview Performance Report</h1>
            <p className="text-indigo-200 text-sm max-w-lg">{session.summary}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 text-center min-w-[160px]">
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">Overall Score</p>
            <div className="text-5xl font-black">{session.overallScore} <span className="text-lg text-indigo-300">/10</span></div>
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors duration-200">
            <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400 flex items-center space-x-2 mb-4">
              <CheckCircle2 className="h-6 w-6" />
              <span>Key Strengths</span>
            </h3>
            <ul className="space-y-3">
              {session.strengths?.map((str, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-start space-x-2">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">•</span>
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors duration-200">
            <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400 flex items-center space-x-2 mb-4">
              <AlertCircle className="h-6 w-6" />
              <span>Areas for Improvement</span>
            </h3>
            <ul className="space-y-3">
              {session.weaknesses && session.weaknesses.length > 0 ? (
                session.weaknesses.map((weak, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300 bg-amber-50/50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-100 dark:border-amber-900/40 flex items-start space-x-2">
                    <span className="font-bold text-amber-600 dark:text-amber-400">•</span>
                    <span>{weak}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  None identified! Outstanding performance.
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Q&A Breakdown */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors duration-200">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <span>Question-by-Question Review</span>
            </h3>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {qaPairs.map((qa, idx) => (
              <div key={qa._id} className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-gray-900 dark:text-white text-base">
                    Q{idx + 1}: {qa.question}
                  </h4>
                  <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold px-3 py-1 rounded-lg text-sm shrink-0 ml-4 border border-indigo-100 dark:border-indigo-800">
                    {qa.score}/10
                  </span>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-100 dark:border-gray-750">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Your Answer:</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{qa.userAnswer}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase mb-1">Good Points:</p>
                    <ul className="text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
                      {qa.goodPoints?.map((gp, i) => <li key={i}>• {gp}</li>)}
                    </ul>
                  </div>

                  <div className="bg-amber-50/50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-100 dark:border-amber-900/40">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase mb-1">Missing Points:</p>
                    <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                      {qa.missingPoints?.map((mp, i) => <li key={i}>• {mp}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="bg-indigo-50/30 dark:bg-indigo-950/30 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                  <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase mb-1">Ideal Answer Hint:</p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400">{qa.idealAnswerHint}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionSummaryPage;
