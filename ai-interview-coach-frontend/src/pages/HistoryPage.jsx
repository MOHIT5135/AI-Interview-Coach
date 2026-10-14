import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Navbar from '../components/common/Navbar';
import { History as HistoryIcon, Trophy, Trash2, ArrowRight } from 'lucide-react';

const HistoryPage = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await axiosClient.get('/history');
        setHistory(data);
      } catch (err) {
        console.error('Failed to fetch history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const handleDelete = async (sessionId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this session?')) return;
    try {
      await axiosClient.delete(`/history/${sessionId}`);
      setHistory(history.filter(h => h._id !== sessionId));
    } catch (err) {
      console.error('Failed to delete session:', err);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col transition-colors duration-200">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Interview History</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Review all your past completed mock interview sessions.</p>
        </div>

        {history.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center text-gray-500 dark:text-gray-400 transition-colors duration-200">
            No past interview sessions found.
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800 transition-colors duration-200">
            {history.map((session) => (
              <div
                key={session._id}
                onClick={() => navigate(`/summary/${session._id}`)}
                className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold px-4 py-3 rounded-xl text-xl border border-indigo-100 dark:border-indigo-800">
                    {session.overallScore}/10
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{session.role}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                      Difficulty: <span className="font-medium text-gray-700 dark:text-gray-300">{session.difficulty}</span> • Completed on {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={(e) => handleDelete(session._id, e)}
                    className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-2 rounded-lg transition cursor-pointer"
                    title="Delete session"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                  <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
