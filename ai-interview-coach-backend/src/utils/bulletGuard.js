'use strict';
/**
 * bulletGuard.js
 * Generic anti-fabrication checks for AI-rewritten resume bullets. No AI, no tech lists.
 *
 * A rewritten bullet is accepted only if:
 *  1. every number in the original bullet is still there, and no new number appears
 *     that is not already somewhere in the resume;
 *  2. every technology-like or proper-noun token in it already appears in the ORIGINAL RESUME
 *     (so "PostgreSQL" cannot be added to a resume that never mentions it);
 *  3. its length stays within a sane range of the original, and it is actually different.
 * Anything else falls back to the original bullet.
 */
const normSpace = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const baseTokens = (s) => String(s || '')
  .toLowerCase()
  .replace(/[^a-z0-9+#./%-]+/g, ' ')
  .split(/\s+/)
  .map((t) => t.replace(/^[.\-/]+|[.\-/]+$/g, ''))
  .filter(Boolean);

const variants = (tok) => {
  const out = new Set([tok]);
  if (tok.endsWith('s')) out.add(tok.slice(0, -1));
  else out.add(`${tok}s`);
  tok.split(/[./-]/).forEach((p) => { if (p) { out.add(p); if (p.endsWith('s')) out.add(p.slice(0, -1)); } });
  return out;
};

const buildAllowed = (resumeText) => {
  const allowed = new Set();
  baseTokens(resumeText).forEach((t) => variants(t).forEach((v) => allowed.add(v)));
  return allowed;
};

const STOP = new Set('a an and are as at be by for from in into is it of on or that the their this to using with via while within across over per its them these those was were will'.split(' '));
const contentTokens = (s) => baseTokens(s).filter((t) => !STOP.has(t));

// share of the original's meaningful words that survive in the rewrite (stops bullet swapping)
const overlap = (original, suggested) => {
  const o = contentTokens(original);
  if (!o.length) return 1;
  const sv = new Set();
  contentTokens(suggested).forEach((t) => variants(t).forEach((v) => sv.add(v)));
  const kept = o.filter((t) => [...variants(t)].some((v) => sv.has(v))).length;
  return kept / o.length;
};

const numbersOf = (s) => (String(s || '').match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, ''));

const stripEdges = (w) => w
  .replace(/^[("'\[{]+/, '')
  .replace(/[)"'\]},;:!?]+$/, '')
  .replace(/\.$/, '');

// Tokens that look like technologies, products, or proper nouns (language-agnostic shape rules).
const ACTION_VERBS = new Set([
  'architected', 'engineered', 'spearheaded', 'implemented', 'optimized', 'developed',
  'designed', 'refactored', 'streamlined', 'orchestrated', 'deployed', 'automated',
  'accelerated', 'established', 'integrated', 'formulated', 'constructed', 'enhanced',
  'executed', 'eliminated', 'scaled', 'reduced', 'increased', 'standardized'
]);

const termLikeTokens = (text) => {
  const raw = normSpace(text).split(' ');
  const found = [];
  raw.forEach((token, idx) => {
    const w = stripEdges(token);
    if (!w || /^[\d.,%≈~+\-–x]+[a-z%]*$/i.test(w)) return;
    if (ACTION_VERBS.has(w.toLowerCase())) return; // Whitelist check

    const prev = idx > 0 ? raw[idx - 1] : '';
    const sentenceStart = idx === 0 || /[.!?:;]$/.test(prev);
    const camel = /[a-z][A-Z]/.test(w);
    const allCaps = /^[A-Z]{2,}[A-Z0-9+#/.-]*$/.test(w);
    const alnum = /[0-9]/.test(w) && /[A-Za-z]/.test(w);
    const dotted = /[A-Za-z]\.[A-Za-z]/.test(w);
    const symbol = /[+#]/.test(w) && /[A-Za-z]/.test(w);
    const capitalMid = /^[A-Z][a-z]+/.test(w) && !sentenceStart;
    if (camel || allCaps || alnum || dotted || symbol || capitalMid) found.push(w);
  });
  return found;
};

const isAllowed = (word, allowed) => {
  const t = word.toLowerCase().replace(/^[.\-/]+|[.\-/]+$/g, '');
  if (allowed.has(t) || allowed.has(t.replace(/s$/, ''))) return true;
  const parts = t.split(/[./-]/).filter(Boolean);
  return parts.length > 1 && parts.every((p) => allowed.has(p) || allowed.has(p.replace(/s$/, '')));
};

const validateEdit = (original, suggested, resumeText, allowedSet = null) => {
  const reasons = [];
  const o = normSpace(original);
  const s = normSpace(suggested);
  if (!s) return { ok: false, reasons: ['empty'] };
  if (s.toLowerCase() === o.toLowerCase()) return { ok: false, reasons: ['unchanged'] };
  if (/[\[\]]/.test(s)) reasons.push('contains brackets');
  if (/\b(would typically|presumably|likely)\b/i.test(s)) reasons.push('hedged wording');

  const ratio = s.length / Math.max(1, o.length);
  if (ratio < 0.6 || ratio > 1.5) reasons.push(`length ratio ${ratio.toFixed(2)}`);

  const cover = overlap(o, s);
  if (cover < 0.45) reasons.push(`low overlap with original (${Math.round(cover * 100)}%)`);

  const allowed = allowedSet || buildAllowed(resumeText);

  const sNums = new Set(numbersOf(s));
  const missingNums = numbersOf(o).filter((n) => !sNums.has(n));
  if (missingNums.length) reasons.push(`dropped numbers: ${missingNums.join(', ')}`);
  const resumeNums = new Set(numbersOf(resumeText));
  const newNums = [...sNums].filter((n) => !resumeNums.has(n));
  if (newNums.length) reasons.push(`new numbers: ${newNums.join(', ')}`);

  const introduced = termLikeTokens(s).filter((w) => !isAllowed(w, allowed));
  if (introduced.length) reasons.push(`introduced terms: ${[...new Set(introduced)].join(', ')}`);

  return { ok: reasons.length === 0, reasons };
};

// Emphasis keywords are usable only if the resume already contains them.
const splitKeywordsByPresence = (keywords, resumeText) => {
  const allowed = buildAllowed(resumeText);
  const usable = [];
  const skipped = [];
  (keywords || []).forEach((k) => {
    const kw = String(k || '').trim();
    if (!kw) return;
    const toks = baseTokens(kw);
    const present = toks.length > 0 && toks.every((t) => allowed.has(t) || allowed.has(t.replace(/s$/, '')) || variants(t).size && [...variants(t)].some((v) => allowed.has(v)));
    (present ? usable : skipped).push(kw);
  });
  return { usable, skipped };
};

module.exports = { validateEdit, splitKeywordsByPresence, buildAllowed, termLikeTokens };
