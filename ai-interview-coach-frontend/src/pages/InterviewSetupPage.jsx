import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { Code, Server, Layers, Database, Cpu, Shield, ArrowRight, Upload, Loader2, X } from 'lucide-react';

const ROLES = [
  { id: 'Frontend Developer', name: 'Frontend Developer', icon: Code, desc: 'React, TypeScript, CSS, Performance' },
  { id: 'Backend Developer', name: 'Backend Developer', icon: Server, desc: 'Node.js, Express, Databases, APIs' },
  { id: 'Full Stack Developer', name: 'Full Stack Developer', icon: Layers, desc: 'End-to-end web architecture & DBs' },
  { id: 'Data Scientist', name: 'Data Scientist', icon: Database, desc: 'Python, ML, Statistics, Pandas' },
  { id: 'DevOps Engineer', name: 'DevOps Engineer', icon: Cpu, desc: 'Docker, Kubernetes, CI/CD, AWS' },
  { id: 'System Design', name: 'System Design', icon: Shield, desc: 'Scalability, Load Balancing, Microservices' },
];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const InterviewSetupPage = () => {
  const [selectedRole, setSelectedRole] = useState('Frontend Developer');
  const [selectedDifficulty, setSelectedDifficulty] = useState('Medium');
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('role', selectedRole);
      formData.append('difficulty', selectedDifficulty);
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      const token = JSON.parse(localStorage.getItem('userInfo'))?.token;
      const res = await fetch('http://localhost:5000/api/interview/start', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');

      navigate('/interview', {
        state: {
          role: selectedRole,
          difficulty: selectedDifficulty,
          initialSessionData: data,
        },
      });
    } catch (err) {
      console.error('Failed to start interview:', err);
      alert('Failed to start interview session');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col transition-colors duration-200">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-12 flex-1 w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Configure Your Mock Interview</h1>
          <p className="text-gray-600 dark:text-gray-400">Select your target job role, difficulty level, and optional resume for tailored questions.</p>
        </div>

        {/* Role Selection */}
        <div className="mb-8">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-4">1. Select Job Role</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ROLES.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;
              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div>
                    <div className={`p-3 rounded-xl w-fit mb-3 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{role.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{role.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Difficulty Selection */}
        <div className="mb-8">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-4">2. Select Difficulty</label>
          <div className="grid grid-cols-3 gap-4">
            {DIFFICULTIES.map((diff) => {
              const isSelected = selectedDifficulty === diff;
              return (
                <div
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`p-4 rounded-xl border-2 cursor-pointer text-center font-bold transition ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  {diff}
                </div>
              );
            })}
          </div>
        </div>

        {/* Optional Resume Upload */}
        <div className="mb-10">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-4">3. Upload Resume (Optional - PDF)</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 bg-white dark:bg-gray-900 text-center hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer transition"
          >
            <input
              type="file"
              accept=".pdf"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center">
              <Upload className="h-10 w-10 text-indigo-600 dark:text-indigo-400 mb-2" />
              {resumeFile ? (
                <div className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-xl font-semibold border border-indigo-100 dark:border-indigo-800">
                  <span>{resumeFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setResumeFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-indigo-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">Click to upload your resume PDF</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">AI will tailor questions to your experience</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="flex justify-end">
          <button
            onClick={handleStart}
            disabled={loading}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-semibold px-8 py-4 rounded-xl shadow-lg transition text-lg cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Preparing Interview...</span>
              </>
            ) : (
              <>
                <span>Start Interview</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewSetupPage;
