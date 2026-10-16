import React, { useState, useRef, useEffect } from 'react';
import useResumeStore from '../store/resumeStore';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { Upload, X, Wand2, Loader2, CheckCircle2, ArrowRight, Download } from 'lucide-react';
import axiosClient from '../api/axiosClient';

const ResumeOptimizerPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [resumeFile, setResumeFile] = useState(location.state?.resumeFile || null);

  // Restore analysisResult and targetRole from location or sessionStorage
  const [analysisResult, setAnalysisResult] = useState(() => {
    if (location.state?.preLoadedAnalysis) return location.state.preLoadedAnalysis;
    try {
      const saved = sessionStorage.getItem('active_ats_analysis');
      return saved ? JSON.parse(saved).preLoadedAnalysis : null;
    } catch (_) { return null; }
  });

  const [targetRole, setTargetRole] = useState(() => {
    if (location.state?.targetRole) return location.state.targetRole;
    try {
      const saved = sessionStorage.getItem('active_ats_analysis');
      return saved ? JSON.parse(saved).targetRole : '';
    } catch (_) { return ''; }
  });

  const atsFindings = useResumeStore((state) => state.atsFindings);
  const selectedKeywords = useResumeStore((state) => state.selectedKeywords);

  const [customKeywords, setCustomKeywords] = useState(() => {
    return selectedKeywords && selectedKeywords.length > 0
      ? selectedKeywords
      : (atsFindings?.missingKeywords || ['React', 'Node.js', 'TypeScript', 'Tailwind', 'REST APIs']);
  });
  const [keywordInput, setKeywordInput] = useState('');

  const handleAddKeyword = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();
      const trimmed = keywordInput.trim();
      if (trimmed && !customKeywords.includes(trimmed)) {
        const updated = [...customKeywords, trimmed];
        setCustomKeywords(updated);
        useResumeStore.getState().setSelectedKeywords(updated);
        setKeywordInput('');
      }
    }
  };

  const handleRemoveKeyword = (keywordToRemove) => {
    const updated = customKeywords.filter(k => k !== keywordToRemove);
    setCustomKeywords(updated);
    useResumeStore.getState().setSelectedKeywords(updated);
  };

  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [optimizationMode, setOptimizationMode] = useState('both');
  const fileInputRef = useRef(null);

  // Load suggestions from handoff state or API response
  useEffect(() => {
    if (analysisResult && analysisResult.bulletProposals && !suggestions) {
      const originalMap = analysisResult.bulletProposals.original || {};
      const optimizedMap = analysisResult.bulletProposals.optimized || {};

      const sugList = Object.keys(originalMap).map(id => {
        const optData = optimizedMap[id] || {};
        const originalText = typeof originalMap[id] === 'object' ? JSON.stringify(originalMap[id]) : String(originalMap[id] || '');
        const suggestedText = typeof optData === 'string' ? optData : (optData.text || originalText);
        const reasonText = typeof optData === 'string'
          ? 'Optimized to align with target role.'
          : (optData.reason || 'Optimized for target role and approved keywords.');

        return {
          id,
          section: id.startsWith('exp') ? 'Experience' : 'Projects',
          originalBullet: originalText,
          suggestedBullet: suggestedText,
          reason: reasonText
        };
      });
      setSuggestions(sugList);
    }
  }, [analysisResult, suggestions]);

  const handleOptimize = async () => {
    if (!resumeFile || !targetRole.trim()) {
      alert('Please upload a resume and enter a target role.');
      return;
    }

    setLoading(true);
    setSuggestions(null);
    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);
      formData.append('jobDescription', targetRole);
      formData.append('approvedKeywords', JSON.stringify(customKeywords));
      formData.append('optimizationMode', optimizationMode);

      const res = await axiosClient.post('/resume/analyze-and-suggest', formData);
      setAnalysisResult(res.data);

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
    } catch (err) {
      console.error('Optimization failed:', err);
      alert('Failed to generate suggestions.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!analysisResult) return;
    setDownloadingPdf(true);

    try {
      const baseJson = analysisResult.originalResume?.structuredJSON || analysisResult.originalResume || {};
      const finalJson = JSON.parse(JSON.stringify(baseJson));

      // Matches exp_0, exp_b0, b0, or exact text
      const injectBullets = (sectionList, prefix) => {
        if (!Array.isArray(sectionList)) return sectionList;
        return sectionList.map((entry, entryIdx) => {
          if (!entry || !Array.isArray(entry.bullets)) return entry;
          return {
            ...entry,
            bullets: entry.bullets.map((bText, bIdx) => {
              const match = suggestions?.find(s => 
                s.id === `${prefix}_${bIdx}` || 
                s.id === `${prefix}_b${bIdx}` ||
                s.id === `b${bIdx}` ||
                s.originalBullet.trim() === bText.trim()
              );
              return match ? match.suggestedBullet : bText;
            })
          };
        });
      };

      if (finalJson.experience) finalJson.experience = injectBullets(finalJson.experience, 'exp');
      if (finalJson.projects) finalJson.projects = injectBullets(finalJson.projects, 'proj');

      if (customKeywords && customKeywords.length > 0) {
        if (!finalJson.skills || typeof finalJson.skills !== 'object') {
          finalJson.skills = {};
        }
        finalJson.skills["Targeted ATS Skills"] = customKeywords.join(', ');
      }

      const res = await axiosClient.post('/resume/generate-final-pdf', {
        finalApprovedResumeJson: finalJson,
        targetRole
      }, { responseType: 'blob' });

      const blob = res.data;
      const contentDisposition = res.headers['content-disposition'];
      let downloadFilename = `Optimized_Resume_${targetRole.replace(/\s+/g, '_')}.pdf`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        downloadFilename = contentDisposition.split('filename=')[1].replace(/["']/g, '');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download PDF failed:', err);
      alert('Failed to download optimized PDF.');
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

            <label className="block font-bold mb-2">2. Target Role / Job Requirements</label>
            <input
              type="text"
              placeholder="e.g. Senior Full Stack Engineer"
              className="w-full p-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 mb-6"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />

            <label className="block font-bold mb-2">3. Keywords to Emphasize</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {customKeywords.map(k => (
                <span key={k} className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm flex items-center space-x-1">
                  <span>{k}</span>
                  <button onClick={() => handleRemoveKeyword(k)} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2 mb-6">
              <input
                type="text"
                placeholder="Add custom keyword..."
                className="flex-1 p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleAddKeyword}
              />
              <button onClick={handleAddKeyword} className="px-4 bg-gray-200 dark:bg-gray-800 font-bold rounded-lg text-sm">Add</button>
            </div>

            <button
              onClick={handleOptimize}
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition flex items-center justify-center cursor-pointer"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Re-Run Optimization'}
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col">
            <h2 className="font-bold text-xl mb-4">Optimized Bullet Proposals</h2>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-indigo-600">
                <Loader2 className="h-10 w-10 animate-spin mb-4" />
                <p className="font-semibold animate-pulse">Rewriting bullets with anti-hallucination checks...</p>
              </div>
            ) : suggestions ? (
              <div className="space-y-4 flex-1 overflow-y-auto max-h-[600px] pr-2">
                {suggestions.map((s, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 space-y-2">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{s.section}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-through">{s.originalBullet}</p>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{s.suggestedBullet}</p>
                  </div>
                ))}

                <button
                  onClick={handleDownloadPDF}
                  disabled={downloadingPdf}
                  className="w-full mt-4 flex items-center justify-center space-x-2 bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition cursor-pointer"
                >
                  {downloadingPdf ? <Loader2 className="animate-spin h-5 w-5" /> : <Download className="h-5 w-5" />}
                  <span>{downloadingPdf ? 'Exporting PDF...' : 'Download Optimized PDF'}</span>
                </button>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">Run optimization or pass from ATS Checker to preview.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeOptimizerPage;