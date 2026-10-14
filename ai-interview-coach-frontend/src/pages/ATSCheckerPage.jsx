import React, { useState, useRef } from 'react';
import useResumeStore from '../store/resumeStore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { Upload, CheckCircle2, AlertCircle, Loader2, X, Wand2 } from 'lucide-react';
import axiosClient from '../api/axiosClient';

const ATSCheckerPage = () => {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const setAtsFindings = useResumeStore((state) => state.setAtsFindings);

  const handleCheck = async () => {
    if (!resumeFile || !jobDescription.trim()) {
      alert('Please upload a resume and paste the job description.');
      return;
    }

    setLoading(true);
    setResults(null); // Clear previous results
    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);
      formData.append('jobDescription', jobDescription);

      const res = await axiosClient.post('/resume/check', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResults(res.data);
      setAtsFindings(res.data);
      useResumeStore.getState().setSelectedKeywords(res.data.missingKeywords || []);
    } catch (err) {
      console.error('ATS check failed:', err);
      alert('Failed to analyze resume.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-extrabold mb-6">ATS Resume Checker</h1>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            <label className="block font-bold mb-2">1. Upload Resume</label>
            <div
              onClick={() => !resumeFile && fileInputRef.current?.click()}
              className={`border-2 border-dashed ${resumeFile ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40' : 'border-gray-300 dark:border-gray-700'} rounded-2xl p-6 text-center cursor-pointer mb-6 relative`}
            >
              <input type="file" accept=".pdf" ref={fileInputRef} className="hidden" onChange={(e) => setResumeFile(e.target.files[0])} />

              {resumeFile ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setResumeFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="absolute top-2 right-2 p-1 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 rounded-full hover:bg-red-200 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="font-medium text-indigo-700 dark:text-indigo-300 truncate px-4">{resumeFile.name}</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-indigo-600 mb-2" />
                  <p>Upload PDF Resume</p>
                </>
              )}
            </div>

            <label className="block font-bold mb-2">2. Paste Job Description</label>
            <textarea
              className="w-full p-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              rows={8}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />

            <button
              onClick={handleCheck}
              disabled={loading}
              className="w-full mt-6 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition flex items-center justify-center cursor-pointer"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Run ATS Check'}
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 min-h-[400px] flex flex-col">
            <h2 className="font-bold text-xl mb-4">Results</h2>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Loader2 className="h-10 w-10 animate-spin mb-4" />
                <p className="font-semibold animate-pulse">Analyzing your resume against the JD...</p>
              </div>
            ) : results ? (
              <div className="space-y-4 flex-1">
                <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{results.matchScore}% Match</div>
                {results.note && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">{results.note}</p>
                )}
                {results.matchedKeywords?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">Matched Keywords:</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{results.matchedKeywords.join(', ')}</p>
                  </div>
                )}
                {results.formattingIssues?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">Formatting Issues:</h4>
                    <ul className="text-sm list-disc pl-5 text-gray-600 dark:text-gray-300">
                      {results.formattingIssues.map((f) => <li key={f}>{f}</li>)}
                    </ul>
                  </div>
                )}
                <div>
                  <h4 className="font-bold flex items-center text-gray-900 dark:text-white"><CheckCircle2 className="h-4 w-4 mr-2" /> Missing Keywords:</h4>
                  <ul className="text-sm list-disc pl-5 mt-2 space-y-1">{results.missingKeywords.length > 0 ? results.missingKeywords.map(k => <li key={k} className="text-gray-600 dark:text-gray-300">{k}</li>) : <li className="text-gray-600 dark:text-gray-300">None</li>}</ul>
                </div>
                <div>
                  <h4 className="font-bold flex items-center text-gray-900 dark:text-white"><AlertCircle className="h-4 w-4 mr-2" /> Suggestions:</h4>
                  <ul className="text-sm list-disc pl-5 mt-2 space-y-1">{results.suggestions.map(s => <li key={s} className="text-gray-600 dark:text-gray-300">{s}</li>)}</ul>
                </div>

                <button
                  onClick={() => navigate('/resume-optimizer', { state: { resumeFile } })}
                  className="w-full mt-6 flex items-center justify-center space-x-2 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition cursor-pointer"
                >
                  <Wand2 className="h-5 w-5" />
                  <span>Enhance with Optimizer</span>
                </button>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">Run the check to see insights.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ATSCheckerPage;
