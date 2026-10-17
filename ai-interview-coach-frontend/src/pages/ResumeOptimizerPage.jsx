import React, { useState, useRef } from 'react';
import useResumeStore from '../store/resumeStore';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { Upload, X, Wand2, Loader2, Download, Layers, CheckSquare, Sparkles } from 'lucide-react';
import axiosClient from '../api/axiosClient';

// Helper: Converts "Full Stack DEveloper" -> "Full Stack Developer"
const toTitleCase = (str) => {
  if (!str) return '';
  return str.replace(/\b\w+/g, (word) => {
    const upper = word.toUpperCase();
    if (['AI', 'ML', 'AWS', 'MERN', 'SDE', 'API', 'UI', 'UX', 'IT', 'RN', 'ICU', 'BLS', 'ACLS'].includes(upper)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
};

const ResumeOptimizerPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [resumeFile, setResumeFile] = useState(location.state?.resumeFile || null);
  const [targetRole, setTargetRole] = useState('');
  const [originalResume, setOriginalResume] = useState(location.state?.originalResume || null);

  const initialKeywords = location.state?.missingKeywords || ['React', 'Node.js', 'TypeScript', 'Tailwind', 'REST APIs'];
  const [customKeywords, setCustomKeywords] = useState(initialKeywords);
  const [keywordInput, setKeywordInput] = useState('');

  // Mode Selection: 'skills_only' vs 'both'
  const [optimizationMode, setOptimizationMode] = useState('both');

  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [optimizedSummary, setOptimizedSummary] = useState(null);

  const fileInputRef = useRef(null);

  const handleAddKeyword = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();
      const trimmed = keywordInput.trim();
      if (trimmed && !customKeywords.includes(trimmed)) {
        setCustomKeywords([...customKeywords, trimmed]);
        setKeywordInput('');
      }
    }
  };

  const handleRemoveKeyword = (kw) => {
    setCustomKeywords(customKeywords.filter(k => k !== kw));
  };

  const handleOptimize = async () => {
    if (!resumeFile || !targetRole.trim()) {
      alert('Please upload a resume and enter your target role.');
      return;
    }

    setLoading(true);
    setSuggestions(null);
    setOptimizedSummary(null);
    try {
      const formattedRole = toTitleCase(targetRole.trim());
      setTargetRole(formattedRole);

      const formData = new FormData();
      formData.append('resume', resumeFile);
      formData.append('targetRole', formattedRole);
      formData.append('approvedKeywords', JSON.stringify(customKeywords));
      formData.append('optimizationMode', optimizationMode);

      const res = await axiosClient.post('/resume/optimize', formData);

      // Save parsed resume structure cleanly
      const structured = res.data.structuredJSON || res.data.originalResume?.structuredJSON || res.data.originalResume;
      setOriginalResume(structured);

      const originalMap = res.data.bulletProposals?.original || {};
      const optimizedMap = res.data.bulletProposals?.optimized || {};

      const sugList = Object.keys(originalMap).map(id => ({
        id,
        section: id.startsWith('exp') ? 'Experience' : 'Projects',
        originalBullet: String(originalMap[id] || ''),
        suggestedBullet: String(optimizedMap[id] || originalMap[id] || ''),
        reason: 'Optimized for target role.'
      }));

      setSuggestions(sugList);
      if (res.data.optimizedSummary) {
        setOptimizedSummary(res.data.optimizedSummary);
      }
    } catch (err) {
      console.error('Optimization error:', err);
      alert('Failed to generate suggestions. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    const baseJson = originalResume?.structuredJSON || originalResume;
    if (!baseJson || (!baseJson.name && !baseJson.header && !baseJson.blocks)) {
      alert('Resume structure not found. Please upload and click Run Optimizer first.');
      return;
    }
    setDownloadingPdf(true);

    try {
      // Safe clone of base structure
      const finalJson = JSON.parse(JSON.stringify(baseJson));

      // Title Case headline role
      if (targetRole && targetRole.trim()) {
        finalJson.role = toTitleCase(targetRole.trim());
      }

      // Enhanced Summary
      if (optimizedSummary) {
        finalJson.summary = optimizedSummary;
      }

      // Safe bullet replacement
      const replaceBullets = (entriesList) => {
        if (!Array.isArray(entriesList)) return entriesList;
        return entriesList.map(entry => {
          if (!entry || !Array.isArray(entry.bullets)) return entry;
          return {
            ...entry,
            bullets: entry.bullets.map(bText => {
              const clean = String(bText).replace(/^[•\-\*•\d+\.]\s*/, '').trim();
              const match = suggestions?.find(s => 
                s.originalBullet.trim() === clean || 
                s.originalBullet.trim() === String(bText).trim() ||
                (clean.length > 15 && s.originalBullet.includes(clean.slice(0, 20)))
              );
              return match ? match.suggestedBullet : bText;
            })
          };
        });
      };

      if (finalJson.experience) finalJson.experience = replaceBullets(finalJson.experience);
      if (finalJson.projects) finalJson.projects = replaceBullets(finalJson.projects);

      const res = await axiosClient.post('/resume/generate-final-pdf', {
        finalApprovedResumeJson: finalJson,
        targetRole: toTitleCase(targetRole.trim()),
        customKeywords
      }, { responseType: 'blob' });

      // Handle download safely
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const downloadName = `${(finalJson.name || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_')}_Optimized_Resume.pdf`;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      let errorMsg = 'Failed to download PDF.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.error) errorMsg = json.error;
        } catch (_) {}
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err.message) {
        errorMsg = err.message;
      }
      alert(errorMsg);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-extrabold mb-6">Resume Optimizer</h1>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 h-fit">
            <label className="block font-bold mb-2">1. Resume File</label>
            <div
              onClick={() => !resumeFile && fileInputRef.current?.click()}
              className={`border-2 border-dashed ${resumeFile ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40' : 'border-gray-300 dark:border-gray-700'} rounded-2xl p-6 text-center cursor-pointer mb-6 relative`}
            >
              <input type="file" accept=".pdf" ref={fileInputRef} className="hidden" onChange={(e) => setResumeFile(e.target.files[0])} />
              {resumeFile ? (
                <>
                  <p className="font-semibold text-indigo-600 dark:text-indigo-400 truncate">{resumeFile.name}</p>
                  <p className="text-xs text-gray-400 mt-1">Click X to clear</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setResumeFile(null); setOriginalResume(null); setSuggestions(null); }}
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Click to upload resume PDF</span>
                </div>
              )}
            </div>

            <label className="block font-bold mb-2">2. Target Role / Job Requirements</label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(toTitleCase(e.target.value))}
              placeholder="e.g. Full Stack Developer"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent mb-6 focus:ring-2 focus:ring-indigo-500 outline-none"
            />

            <label className="block font-bold mb-2">3. Keywords to Emphasize</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleAddKeyword}
                placeholder="Add custom keyword..."
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button onClick={handleAddKeyword} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {customKeywords.map(k => (
                <span key={k} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-semibold">
                  <span>{k}</span>
                  <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => handleRemoveKeyword(k)} />
                </span>
              ))}
            </div>

            <label className="block font-bold mb-3">4. Keyword Placement Strategy</label>
            <div className="space-y-3 mb-6">
              <div
                onClick={() => setOptimizationMode('skills_only')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  optimizationMode === 'skills_only'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="h-4 w-4 text-indigo-600" />
                  <span className="font-semibold text-sm">Skills Section Only</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 pl-6.5">
                  Categorizes keywords into respective tech stacks without altering project bullets.
                </p>
              </div>

              <div
                onClick={() => setOptimizationMode('both')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  optimizationMode === 'both'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="h-4 w-4 mr-1.5 text-indigo-600" />
                  <span className="font-semibold text-sm">Skills + Applicable Projects</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 pl-6.5">
                  Adds to skills categories and integrates into relevant project bullets where applicable.
                </p>
              </div>
            </div>

            <button
              onClick={handleOptimize}
              disabled={loading || !resumeFile || !targetRole.trim()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
              {loading ? 'Optimizing Resume...' : 'Run Optimizer'}
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                Optimized Resume Enhancements
              </h2>

              {optimizedSummary && (
                <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-950/20 mb-6">
                  <p className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 mb-1">Enhanced Professional Summary</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{optimizedSummary}</p>
                </div>
              )}

              {suggestions ? (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {suggestions.map((s, idx) => (
                    <div key={idx} className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.section}</span>
                      <p className="text-xs line-through text-red-500 mt-1">{s.originalBullet}</p>
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1.5">{s.suggestedBullet}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm">
                  Upload your resume and click &quot;Run Optimizer&quot; to review bullet changes.
                </div>
              )}
            </div>

            {suggestions && (
              <button
                onClick={handleDownloadPDF}
                disabled={downloadingPdf}
                className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition"
              >
                {downloadingPdf ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                {downloadingPdf ? 'Generating PDF...' : 'Download Optimized PDF'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeOptimizerPage;