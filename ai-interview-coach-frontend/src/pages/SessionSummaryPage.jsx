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
      const response = await axiosClient.get(`/dashboard/report/${sessionId}`, {
        responseType: 'blob' // CRITICAL for PDFs
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;

      // Check headers for server-provided filename, fallback to default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `Interview_Report_${data.session.role}_${new Date(data.session.createdAt).toISOString().split('T')[0]}.pdf`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/["']/g, '');
      }

      a.download = filename;
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

      <div className="max-w-4xl mx-auto px-4 py-12 flex-1 w-full">
        {/* Top bar */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 transition font-medium cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Dashboard</span>
          </button>

          <button
            onClick={handleDownloadReport}
            disabled={downloading}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl shadow transition cursor-pointer disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            <span>{downloading ? 'Generating PDF...' : 'Download PDF Report'}</span>
          </button>
        </div>

        {/* Hero Score Card */}
        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-full uppercase tracking-wider">
              Interview Complete
            </span>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white">{session.role}</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Difficulty: <span className="text-gray-900 dark:text-white font-bold">{session.difficulty}</span> &bull; {new Date(session.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center space-x-4 bg-indigo-600 text-white px-8 py-6 rounded-2xl shadow-md">
            <Trophy className="h-10 w-10 text-amber-300" />
            <div>
              <div className="text-3xl font-black">{session.overallScore}/10</div>
              <div className="text-xs uppercase tracking-wider text-indigo-200">Overall Score</div>
            </div>
          </div>
        </div>

        {/* Summary & Key Strengths/Weaknesses */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-900/50">
            <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mb-4 flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2" /> Key Strengths
            </h3>
            <ul className="space-y-2">
              {session.strengths?.map((s, i) => (
                <li key={i} className="flex items-start space-x-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-amber-100 dark:border-amber-900/50">
            <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-4 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" /> Areas for Improvement
            </h3>
            <ul className="space-y-2">
              {session.weaknesses?.map((w, i) => (
                <li key={i} className="flex items-start space-x-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Q&A Breakdown */}
        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Question-by-Question Review</h2>

          <div className="space-y-8">
            {qaPairs.map((qa, index) => (
              <div key={index} className="border-b border-gray-100 dark:border-gray-800 pb-8 last:border-0 last:pb-0">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                    Q{index + 1}: {qa.question}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    qa.score >= 8 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' :
                    qa.score >= 6 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' :
                    'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                  }`}>
                    {qa.score}/10
                  </span>
                </div>

               <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl mb-4 border border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 tracking-wider">Your Answer:</p>
                  {/* whitespace-pre-wrap preserves your exact line breaks, lists, and indentation */}
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed font-sans">{qa.userAnswer}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-emerald-50/80 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 text-sm flex items-center mb-2">
                        <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                        What You Did Well:
                      </span>
                      <ul className="space-y-1.5 text-xs text-emerald-950 dark:text-emerald-200 list-disc pl-4 leading-relaxed">
                        {qa.goodPoints?.map((gp, i) => <li key={i}>{gp}</li>)}
                      </ul>
                    </div>
                  </div>
                  <div className="bg-rose-50/80 dark:bg-rose-950/40 p-4 rounded-xl border border-rose-200 dark:border-rose-800/60 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-rose-800 dark:text-rose-300 text-sm flex items-center mb-2">
                        <AlertCircle className="h-4 w-4 mr-1.5 text-rose-600 dark:text-rose-400" />
                        Areas for Improvement (Gaps):
                      </span>
                      <ul className="space-y-1.5 text-xs text-rose-950 dark:text-rose-200 list-disc pl-4 leading-relaxed">
                        {qa.missingPoints?.map((mp, i) => <li key={i}>{mp}</li>)}
                      </ul>
                    </div>
                  </div>
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
