import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Navbar from '../components/common/Navbar';
import { PlusCircle, Trophy, Award, TrendingUp, Calendar, Trash2, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const DashboardPage = () => {
  const [stats, setStats] = useState({ totalInterviews: 0, avgScore: 0 });
  const [progress, setProgress] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, progressRes, historyRes] = await Promise.all([
          axiosClient.get('/dashboard/stats'),
          axiosClient.get('/dashboard/progress'),
          axiosClient.get('/history'),
        ]);
        setStats(statsRes.data);
        setProgress(progressRes.data);
        setHistory(historyRes.data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Welcome Banner */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-8 transition-colors duration-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Interview Readiness Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Track your progress, review past answers, and start new mock interviews.</p>
          </div>
          <button
            onClick={() => navigate('/setup')}
            className="mt-4 md:mt-0 flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow transition cursor-pointer"
          >
            <PlusCircle className="h-5 w-5" />
            <span>Start New Interview</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center space-x-4 transition-colors duration-200">
            <div className="bg-indigo-50 dark:bg-indigo-950/60 p-4 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Trophy className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Completed Interviews</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalInterviews}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center space-x-4 transition-colors duration-200">
            <div className="bg-emerald-50 dark:bg-emerald-950/60 p-4 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Award className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Score</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.avgScore} <span className="text-sm text-gray-400">/ 10</span></h3>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        {progress.length > 0 && (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-8 transition-colors duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <span>Score Trajectory Over Time</span>
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progress}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis domain={[0, 10]} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '0.75rem' }} />
                  <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent Sessions */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors duration-200">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Sessions</h3>
            <Link to="/history" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-semibold flex items-center space-x-1">
              <span>View All</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {history.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              No completed interviews yet. Click "Start New Interview" above to begin!
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.slice(0, 5).map((session) => (
                <div
                  key={session._id}
                  onClick={() => navigate(`/summary/${session._id}`)}
                  className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition"
                >
                  <div className="flex items-center space-x-4">
                    <div className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold px-3 py-2 rounded-xl text-lg">
                      {session.overallScore}/10
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">{session.role}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                        Difficulty: {session.difficulty} • {new Date(session.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => handleDelete(session._id, e)}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-2 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
