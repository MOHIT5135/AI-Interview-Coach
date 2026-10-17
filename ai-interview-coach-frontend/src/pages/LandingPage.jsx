import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/common/Navbar';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Zap,
  LayoutDashboard,
  FileText,
  Layers,
  ChevronDown,
  ChevronUp,
  Trophy,
  AlertCircle
} from 'lucide-react';

const LandingPage = () => {
  const { user } = useAuth();
  const [faqOpen, setFaqOpen] = useState({ 0: true });

  const toggleFaq = (idx) => {
    setFaqOpen(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const faqs = [
    {
      q: "How does the dual-engine ATS scoring system work?",
      a: "Our scoring engine evaluates your resume in two distinct phases: First, ATS Semantic Parsability analyzes whether applicant tracking systems like Greenhouse, Workday, and Lever can parse your section headers, links, and contact coordinates. Second, Content & Recruiter Impact scores your quantified accomplishments (weighting active project and experience demonstrations with double weight)."
    },
    {
      q: "Will the AI optimizer invent skills or experiences I haven't done?",
      a: "Never. We enforce a deterministic anti-hallucination guard with strict token overlap and number preservation rules. The optimizer rewrites wording for STAR-format clarity, active power verbs, and ATS alignment, but it will never fabricate metrics, employers, or ungrounded technical claims."
    },
    {
      q: "Does this work for non-tech resumes like healthcare, nursing, and hospitality?",
      a: "Yes! Our system uses universal domain affinities covering healthcare (BLS, ACLS, RN, EHR systems, triage), hospitality (guest relations, PMS, catering, food & beverage), and business operations, ensuring accurate classification without hardcoded tech locks."
    },
    {
      q: "How does the AI mock interview coach personalize questions?",
      a: "When you attach your resume, the interview coach extracts your specific technical projects, architecture decisions, and metrics. It crafts dynamic, interactive follow-up questions tailored directly to what you built, followed by real-time scoring and constructive gap analysis."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col transition-colors duration-200">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-14 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center flex flex-col items-center">
        <div className="inline-flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-6 shadow-sm">
          <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span>AI-Powered ATS Diagnostic Suite & Mock Interview Coach</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-950 dark:text-white max-w-4xl tracking-tight leading-tight sm:leading-none mb-6">
          Is Your Resume Good Enough to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">Land Real Interviews?</span>
        </h1>

        <p className="text-base sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mb-10 leading-relaxed">
          A dual-engine AI platform that verifies ATS compatibility across 27+ checks, enhances your bullet points without hallucinating facts, and conducts real-time mock interviews based on your projects.
        </p>

        {/* Auth-Aware Call to Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-14 w-full sm:w-auto">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl hover:shadow-indigo-500/25 transition text-base"
              >
                <LayoutDashboard className="h-5 w-5" />
                <span>Go to Dashboard</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/ats-check"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-800 font-bold rounded-2xl shadow-sm transition text-base"
              >
                <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <span>Run ATS Resume Check</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl hover:shadow-indigo-500/25 transition text-base"
              >
                <span>Get Started Free</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-800 font-bold rounded-2xl shadow-sm transition text-base"
              >
                <span>Sign In to Account</span>
              </Link>
            </>
          )}
        </div>

        {/* Enhancv-Style Live Diagnostic Preview Card */}
        <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-8 text-left relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-100 dark:border-gray-800">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Live Diagnostic Simulation</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Full Stack Engineer — ATS Report</h3>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
              <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block leading-none">ATS Match Score</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none">88 / 100</span>
              </div>
            </div>
          </div>

          <div className="py-6 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sample STAR Bullet Enhancement</span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Verified 0% Hallucination</span>
              </div>
              <p className="text-xs line-through text-red-500 dark:text-red-400/90 mb-1.5">
                • Worked on the backend platform and handled database caching to make endpoints faster.
              </p>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                • Architected deterministic caching in MongoDB to eliminate redundant LLM API overhead, cutting round-trip latency by ≈71% (11.7s to 3.4s).
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                <span className="font-bold text-gray-900 dark:text-white block">18 Matched</span>
                <span className="text-gray-500 text-[11px]">Tech Competencies</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                <span className="font-bold text-amber-600 dark:text-amber-400 block">2 Emphasized</span>
                <span className="text-gray-500 text-[11px]">Missing Keywords</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block">1-Page A4</span>
                <span className="text-gray-500 text-[11px]">LaTeX Format</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 block">5 Questions</span>
                <span className="text-gray-500 text-[11px]">AI Mock Interview</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Tested against Greenhouse, Workday, Lever & Taleo ATS standards.</span>
            </div>
            <Link to={user ? "/ats-check" : "/signup"} className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
              <span>Scan Yours Now</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Two-Tier System Section */}
      <section className="py-16 bg-white dark:bg-gray-900 border-y border-gray-200/80 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
              Dual-Engine Scoring Architecture
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              How Our AI Evaluates Your Resume
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mt-4 leading-relaxed">
              An applicant tracking system extracts keywords, while a hiring manager looks for real achievements. Our checker calculates your compatibility using a rigorous, two-tier evaluation system.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-slate-50 dark:bg-gray-800/70 p-8 rounded-3xl border border-gray-200/80 dark:border-gray-700/60 relative">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-600 text-white font-extrabold text-lg mb-6 shadow-md">
                1
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Tier 1: ATS Parsability & Keyword Match
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                Simulates real-world ATS software (Greenhouse, Workday, Lever, Taleo) to test glyph spatial geometry, section classification, contact hyperlinks, and keyword presence. Active demonstration in Experience & Projects earns double weight.
              </p>
              <ul className="space-y-2.5 text-xs text-gray-700 dark:text-gray-300 font-medium">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Linearized reading order & soft-hyphen repair</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Hyperlink annotation extraction (GitHub, LinkedIn, Portfolio)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Universal domain affinity matching across tech, healthcare & business</li>
              </ul>
            </div>

            <div className="bg-slate-50 dark:bg-gray-800/70 p-8 rounded-3xl border border-gray-200/80 dark:border-gray-700/60 relative">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-violet-600 text-white font-extrabold text-lg mb-6 shadow-md">
                2
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Tier 2: Recruiter Eye & Quantified Impact
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                Hiring managers spend 6 seconds reviewing your bullet points. Our AI evaluates the strength of your action verbs, outcome metrics, and clarity using the Google X-Y-Z formula without fabricating unverified claims.
              </p>
              <ul className="space-y-2.5 text-xs text-gray-700 dark:text-gray-300 font-medium">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> STAR-format bullet rewrites with action power verbs</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Strict number & metric preservation (zero hallucination)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Flawless 1-page LaTeX typography export via Puppeteer</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 27+ Crucial Checks Breakdown Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
            Comprehensive Diagnostic Scan
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            27 Crucial Checks Across 6 Essential Pillars
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mt-4 leading-relaxed">
            Our models audit every layer of your application so you can fix fatal resume mistakes before submitting to top companies.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 font-bold">
              <FileText className="h-5 w-5" />
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">ATS Essentials</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
              Verifies layout parsability, clean coordinate extraction, 1-page budget compliance, and standardized heading detection.
            </p>
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-md">
              6 Technical Checks
            </span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4 font-bold">
              <Layers className="h-5 w-5" />
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">Job & Skills Tailoring</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
              Maps hard skills, libraries, databases, and universal competencies against the target job description to eliminate critical gaps.
            </p>
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-md">
              5 Alignment Checks
            </span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 font-bold">
              <Zap className="h-5 w-5" />
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">Quantified Impact</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
              Converts passive task descriptions into measurable accomplishments with action verbs and quantifiable results.
            </p>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-md">
              4 Impact Checks
            </span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">Anti-Hallucination Guard</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
              Ensures every suggested rewrite preserves existing numbers and tools. Blocks fabricated experience from polluting your resume.
            </p>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-md">
              4 Guardrail Checks
            </span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 font-bold">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">Recruiter Red Flags</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
              Identifies ambiguous responsibilities, cliches, weak verbs, missing links, and unformatted contact info.
            </p>
            <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2.5 py-1 rounded-md">
              4 Red Flag Scans
            </span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 font-bold">
              <Trophy className="h-5 w-5" />
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">Live Mock Interview Prep</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
              Generates 5 realistic technical interview questions based directly on your resume projects and target role requirements.
            </p>
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-md">
              4 Interactive Exercises
            </span>
          </div>
        </div>
      </section>

      {/* Put Your Score to Work: Feature Showcase */}
      <section className="py-16 bg-white dark:bg-gray-900 border-t border-gray-200/80 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
              End-to-End Career Acceleration
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Put Your Resume Score to Work
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mt-4 leading-relaxed">
              Checking your resume is step one. Our platform carries you through the rewrite, ATS optimization, and personalized technical interview practice.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/60 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 mb-2 block">Step 1</span>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">ATS Resume Checker</h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                  Upload your PDF and get instant ATS compatibility scoring with categorized missing keyword breakdowns.
                </p>
              </div>
              <Link to={user ? "/ats-check" : "/signup"} className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                <span>Try ATS Checker</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/60 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 mb-2 block">Step 2</span>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">AI Bullet Optimizer</h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                  Review side-by-side proposed rewrites, inject missing skills into their respective tech stacks, and export a clean LaTeX PDF.
                </p>
              </div>
              <Link to={user ? "/resume-optimizer" : "/signup"} className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                <span>Launch Optimizer</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/60 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 mb-2 block">Step 3</span>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Interactive Mock Interview</h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                  Practice 5 dynamic technical interview questions based on your resume projects, with instant scoring and downloadable feedback reports.
                </p>
              </div>
              <Link to={user ? "/interview-setup" : "/signup"} className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                <span>Start Mock Session</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 w-full">
        <div className="text-center mb-12">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
            Frequently Asked Questions
          </h2>
          <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Everything You Need to Know
          </h3>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 overflow-hidden transition-all"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 text-left font-bold text-sm sm:text-base flex justify-between items-center text-gray-900 dark:text-white"
              >
                <span>{faq.q}</span>
                {faqOpen[idx] ? <ChevronUp className="h-5 w-5 text-indigo-500" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>
              {faqOpen[idx] && (
                <div className="px-5 pb-5 text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-800 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 px-4 bg-gradient-to-r from-indigo-600 to-violet-700 text-white text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 tracking-tight">
            Ready to Land More Interview Callbacks?
          </h2>
          <p className="text-base sm:text-lg text-indigo-100 mb-8 max-w-xl mx-auto">
            Create your account now to get instant ATS scoring, verified bullet point rewrites, and personalized AI interview coaching.
          </p>
          <Link
            to={user ? "/ats-check" : "/signup"}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-700 hover:bg-indigo-50 font-bold rounded-2xl shadow-xl text-base transition"
          >
            <span>{user ? "Scan Resume Now" : "Get Started Free"}</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-8 text-center text-gray-500 dark:text-gray-400 text-xs transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span>&copy; 2026 AI Interview Coach. Built for ambitious developers and professionals.</span>
          <div className="flex gap-4">
            <Link to={user ? "/ats-check" : "/signup"} className="hover:text-indigo-600">ATS Checker</Link>
            <Link to={user ? "/resume-optimizer" : "/signup"} className="hover:text-indigo-600">Optimizer</Link>
            <Link to={user ? "/interview-setup" : "/signup"} className="hover:text-indigo-600">Mock Interviews</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;