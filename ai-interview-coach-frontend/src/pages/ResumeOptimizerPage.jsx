import React, { useState, useRef, useEffect } from 'react';
import useResumeStore from '../store/resumeStore';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { Upload, X, Wand2, Loader2, CheckCircle2, ArrowRight, Download } from 'lucide-react';

const ResumeOptimizerPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [resumeFile, setResumeFile] = useState(location.state?.resumeFile || null);
  const [targetRole, setTargetRole] = useState('');

  const atsFindings = useResumeStore((state) => state.atsFindings);
  const selectedKeywords = useResumeStore((state) => state.selectedKeywords);
  const toggleKeyword = useResumeStore((state) => state.toggleKeyword);

  useEffect(() => {
    if (!atsFindings || !resumeFile) {
      navigate('/ats-checker', { replace: true });
    }
  }, [atsFindings, resumeFile, navigate]);

  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const fileInputRef = useRef(null);

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
      formData.append('targetRole', targetRole);
      formData.append('atsFindings', JSON.stringify({ missingKeywords: selectedKeywords }));

      const token = JSON.parse(localStorage.getItem('userInfo'))?.token;
      const res = await fetch('http://localhost:5000/api/resume/suggest-edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Optimization failed');

      const data = await res.json();
      setSuggestions(data);
    } catch (err) {
      console.error('Optimization failed:', err);
      alert('Failed to optimize resume.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadOptimizedPDF = async () => {
    if (!resumeFile || !targetRole.trim() || !suggestions) return;

    setDownloadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);
      formData.append('targetRole', targetRole);
      formData.append('suggestions', JSON.stringify(suggestions));

      const token = JSON.parse(localStorage.getItem('userInfo'))?.token;
      const res = await fetch('http://localhost:5000/api/resume/optimize-pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('PDF generation failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Optimized_Resume_${targetRole.replace(/\s+/g, '_')}.pdf`;
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

            <label className="block font-bold mb-2">2. Target Role / Job Title</label>
            <input
              type="text"
              className="w-full p-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 mb-6"
              placeholder="e.g., Senior React Developer"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />

            {atsFindings?.missingKeywords && (
              <div className="mb-6">
                <label className="block font-bold mb-2">Keywords to Optimize:</label>
                <div className="flex flex-wrap gap-2">
                  {atsFindings.missingKeywords.map(keyword => (
                    <button
                      key={keyword}
                      onClick={() => toggleKeyword(keyword)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                        selectedKeywords.includes(keyword)
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleOptimize}
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition flex items-center justify-center cursor-pointer"
            >
              {loading ? <Loader2 className="animate-spin" /> : <> <Wand2 className="h-5 w-5 mr-2" /> Optimize Resume</>}
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-xl">Optimization Results</h2>
              {suggestions && (
                <button
                  onClick={handleDownloadOptimizedPDF}
                  disabled={downloadingPdf}
                  className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded-xl shadow transition cursor-pointer disabled:bg-gray-300"
                >
                  {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span>{downloadingPdf ? 'Generating PDF...' : 'Download Optimized PDF'}</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Loader2 className="h-10 w-10 animate-spin mb-4" />
                <p className="font-semibold animate-pulse">AI is rewriting your resume bullets...</p>
              </div>
            ) : suggestions ? (
              <div className="space-y-4 flex-1 overflow-y-auto max-h-[550px] pr-2">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Suggested Bullet Point Improvements</span>
                </div>
                {suggestions.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 space-y-2 text-sm">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                      {item.section || 'Experience'}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Original:</p>
                      <p className="text-gray-600 dark:text-gray-300 line-through">{item.originalBullet}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center space-x-1">
                        <ArrowRight className="h-3 w-3 inline" /> <span>Optimized:</span>
                      </p>
                      <p className="font-medium text-gray-900 dark:text-white">{item.suggestedBullet}</p>
                    </div>
                    {item.reason && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 italic">Why: {item.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 text-center">
                Run optimization to get your enhanced resume bullet points.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeOptimizerPage;
