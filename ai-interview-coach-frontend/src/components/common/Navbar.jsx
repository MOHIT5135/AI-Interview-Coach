import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Bot, LogOut, LayoutDashboard, History, Sun, Moon, FileText, Wand2, Menu, X } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 transition-colors duration-200 w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-2">
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="bg-indigo-600 p-1.5 sm:p-2 rounded-xl text-white group-hover:bg-indigo-700 transition">
                <Bot className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <span className="font-bold text-sm sm:text-xl text-gray-900 dark:text-white whitespace-nowrap">
                <span className="inline sm:hidden">AI Coach</span>
                <span className="hidden sm:inline">AI Interview Coach</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation (lg and above) */}
          <div className="hidden lg:flex items-center space-x-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-gray-600" />}
            </button>

            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="flex items-center space-x-1 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-2 rounded-md font-medium text-sm transition"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/history"
                  className="flex items-center space-x-1 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-2 rounded-md font-medium text-sm transition"
                >
                  <History className="h-4 w-4" />
                  <span>History</span>
                </Link>
                <Link
                  to="/ats-checker"
                  className="flex items-center space-x-1 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-2 rounded-md font-medium text-sm transition"
                >
                  <FileText className="h-4 w-4" />
                  <span>ATS</span>
                </Link>
                <Link
                  to="/resume-optimizer"
                  className="flex items-center space-x-1 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-2 rounded-md font-medium text-sm transition"
                >
                  <Wand2 className="h-4 w-4" />
                  <span>Optimizer</span>
                </Link>
                <div className="flex items-center space-x-3 pl-4 border-l border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                    Hi, {user.name}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium px-4 py-2 text-sm transition"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg shadow text-sm transition"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile / Tablet Menu Button (below lg) */}
          <div className="flex lg:hidden items-center space-x-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-gray-600" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile / Tablet Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 pt-2 pb-6 space-y-3 transition-colors">
          {user ? (
            <>
              <div className="py-2 px-3 text-sm font-bold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800 truncate">
                Hi, {user.name}
              </div>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-2 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-800 px-3 py-2.5 rounded-xl font-medium text-sm transition"
              >
                <LayoutDashboard className="h-4 w-4 text-indigo-600" />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/history"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-2 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-800 px-3 py-2.5 rounded-xl font-medium text-sm transition"
              >
                <History className="h-4 w-4 text-indigo-600" />
                <span>History</span>
              </Link>
              <Link
                to="/ats-checker"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-2 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-800 px-3 py-2.5 rounded-xl font-medium text-sm transition"
              >
                <FileText className="h-4 w-4 text-indigo-600" />
                <span>ATS Checker</span>
              </Link>
              <Link
                to="/resume-optimizer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-2 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-800 px-3 py-2.5 rounded-xl font-medium text-sm transition"
              >
                <Wand2 className="h-4 w-4 text-indigo-600" />
                <span>Resume Optimizer</span>
              </Link>
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                className="w-full flex items-center space-x-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-3 py-2.5 rounded-xl font-medium text-sm transition cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col space-y-2 pt-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2.5 font-medium text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2.5 font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow transition"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
