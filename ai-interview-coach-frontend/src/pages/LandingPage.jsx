import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/common/Navbar';
import { Sparkles, ArrowRight, CheckCircle, ShieldCheck, Zap, LayoutDashboard } from 'lucide-react';

const LandingPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 text-gray-900 dark:text-white flex flex-col transition-colors duration-200">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="inline-flex items-center space-x-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
          <Sparkles className="h-4 w-4" />
          <span>AI-Powered Technical Mock Interviews</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 dark:text-white max-w-4xl tracking-tight mb-6">
          Ace Your Next Tech Interview with <span className="text-indigo-600 dark:text-indigo-400">AI Precision</span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mb-10">
          Practice role-based technical interviews, get instant AI feedback on your answers, review missing points, and track your readiness over time.
        </p>

        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-16">
          {user ? (
            <Link
              to="/dashboard"
              className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-4 rounded-xl shadow-lg transition text-lg"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Go to Dashboard</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-4 rounded-xl shadow-lg transition text-lg"
              >
                <span>Get Started Free</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/login"
                className="flex items-center justify-center space-x-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 font-semibold px-8 py-4 rounded-xl transition text-lg shadow-sm"
              >
                <span>Sign In</span>
              </Link>
            </>
          )}
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full px-4 text-left">
          <div className="bg-white dark:bg-gray-800/80 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/60">
            <div className="bg-indigo-50 dark:bg-indigo-950/60 p-3 rounded-xl w-fit text-indigo-600 dark:text-indigo-400 mb-4">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Real-Time AI Evaluation</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Get scored out of 10 for every answer with detailed good points, missing gaps, and ideal answer hints.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800/80 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/60">
            <div className="bg-indigo-50 dark:bg-indigo-950/60 p-3 rounded-xl w-fit text-indigo-600 dark:text-indigo-400 mb-4">
              <CheckCircle className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Role-Specific Practice</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Choose from Frontend, Backend, Full Stack, Data Science, and DevOps with custom difficulty levels.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800/80 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/60">
            <div className="bg-indigo-50 dark:bg-indigo-950/60 p-3 rounded-xl w-fit text-indigo-600 dark:text-indigo-400 mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Progress Dashboard</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Track your score trajectory over time with interactive charts and comprehensive performance reports.
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-6 text-center text-gray-500 dark:text-gray-400 text-sm transition-colors duration-200">
        &copy; 2026 AI Interview Coach. Built for ambitious developers.
      </footer>
    </div>
  );
};

export default LandingPage;
