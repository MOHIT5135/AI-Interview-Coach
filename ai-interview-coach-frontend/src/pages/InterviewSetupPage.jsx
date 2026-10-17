import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { Terminal, Code, Server, Layers, Database, Cpu, Shield, ArrowRight, Upload, Loader2, X } from 'lucide-react';
import axiosClient from '../api/axiosClient';

const ROLES = [
  { id: 'Software Developer', name: 'Software Developer', icon: Terminal, desc: 'DSA, OOP, Algorithms, Core CS' },
  { id: 'Frontend Developer', name: 'Frontend Developer', icon: Code, desc: 'React, TypeScript, CSS, Performance' },
  { id: 'Backend Developer', name: 'Backend Developer', icon: Server, desc: 'Node.js, Express, Databases, APIs' },
  { id: 'Full Stack Developer', name: 'Full Stack Developer', icon: Layers, desc: 'End-to-end web architecture & DBs' },
  { id: 'Data Scientist', name: 'Data Scientist', icon: Database, desc: 'Python, ML, Statistics, Pandas' },
  { id: 'DevOps Engineer', name: 'DevOps Engineer', icon: Cpu, desc: 'Docker, Kubernetes, CI/CD, AWS' },
  { id: 'System Design', name: 'System Design', icon: Shield, desc: 'Scalability, Load Balancing, Microservices' },
];

const DIFFICULTIES = [
  {
    id: 'Easy',
    name: 'Easy',
    desc: 'Basic to intermediate (easy) concepts',
  },
  {
    id: 'Medium',
    name: 'Medium',
    desc: 'Intermediate to vital fundamental concepts',
  },
  {
    id: 'Hard',
    name: 'Hard',
    desc: 'Intermediate (hard) to advanced concepts',
  },
];

const InterviewSetupPage = () => {
  const [selectedRole, setSelectedRole] = useState('Software Developer');
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

      const res = await axiosClient.post('/interview/start', formData);

      navigate('/interview', {
        state: {
          role: selectedRole,
          difficulty: selectedDifficulty,
          initialSessionData: res.data,
        },
      });
    } catch (err) {
      console.error('Failed to start interview:', err);
      alert(err.response?.data?.error || 'Failed to start interview session');
    } finally {
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DIFFICULTIES.map((diff) => {
              const isSelected = selectedDifficulty === diff.id;
              return (
                <div
                  key={diff.id}
                  onClick={() => setSelectedDifficulty(diff.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer text-center transition flex flex-col justify-center items-center ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <span className="font-bold text-base">{diff.name}</span>
                  <span className={`text-xs mt-1 leading-snug font-normal ${isSelected ? 'text-indigo-100' : 'text-gray-500 dark:text-gray-400'}`}>
                    {diff.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resume Upload */}
        <div className="mb-10">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-4">3. Upload Resume (Optional)</label>
          <div
            onClick={() => !resumeFile && fileInputRef.current?.click()}
            className={`border-2 border-dashed ${resumeFile ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40' : 'border-gray-300 dark:border-gray-700'} rounded-2xl p-6 text-center cursor-pointer transition relative`}
          >
            <input type="file" accept=".pdf" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
            {resumeFile ? (
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/55 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Upload className="h-5 w-5" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">{resumeFile.name}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setResumeFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="font-medium text-gray-700 dark:text-gray-300">Click to upload PDF resume</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">We'll use your skills & projects to tailor interview questions</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Initializing Interview...</span>
            </>
          ) : (
            <>
              <span>Start Interview Session</span>
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default InterviewSetupPage;