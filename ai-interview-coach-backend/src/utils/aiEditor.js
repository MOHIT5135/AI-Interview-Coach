'use strict';
/**
 * aiEditor.js
 *
 * Rewrites wording of complete bullets for clarity and target role alignment.
 * Safe model slug resolution prevents "getModel is not a function" crashes.
 */
const { collectBullets } = require('./resumeParser');
const { validateEdit, splitKeywordsByPresence, buildAllowed } = require('./bulletGuard');

const MAX_BULLETS = 16;

const createBulletMap = (parsed) => {
  const original = {};
  const meta = {};
  collectBullets(parsed).slice(0, MAX_BULLETS).forEach((b, n) => {
    const id = `b${n}`;
    original[id] = b.text;
    meta[id] = { section: b.section, entry: b.entry, ref: b.ref, index: b.index };
  });
  return { original, meta };
};

const buildPrompt = (bulletMap, targetRole, usableKeywords) => {
  const list = Object.keys(bulletMap.original).map((id) => `${id}: ${bulletMap.original[id]}`).join('\n');
  return `You are a resume editor. Rewrite each bullet to read clearer and stronger for the target role "${targetRole}" WITHOUT changing any facts.

RULES:
1. Use ONLY facts, technologies, tools, numbers and names that already appear in that same bullet. Do not add any ungrounded technology, metric, or employer.
2. Keep every number, percentage and unit exactly as written.
3. You may improve: action verb, clarity, concision and result-first phrasing. Keep length within about 30% of the original.
4. Emphasis keywords: ${JSON.stringify(usableKeywords)}. Foreground one ONLY if the bullet already mentions it. Never insert a keyword that is not already in the bullet.
5. If a bullet is already strong, return it unchanged.

Return ONLY a JSON object: {"<id>": "<rewritten bullet>"} using the ids below.

BULLETS:
${list}`;
};

const optimizeBulletsWithAI = async (bulletMap, targetRole, keywords, callOpenRouter, getModel, resumeBaseText = '', attested = []) => {
  const resumeText = `${resumeBaseText}\n${(attested || []).join(' ')}`;
  const optimized = {};
  const rejected = {};
  const ids = Object.keys(bulletMap.original);
  if (!ids.length) return { optimized, rejected, skippedKeywords: [] };

  const { usable, skipped } = splitKeywordsByPresence(keywords, resumeText);
  let parsed = {};

  // Safe getModel resolver: supports function, string, or env fallback
  const modelSlug = typeof getModel === 'function'
    ? getModel()
    : (typeof getModel === 'string' && getModel ? getModel : (process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'));

  try {
    const reply = await callOpenRouter(buildPrompt(bulletMap, targetRole, usable), 0.2, modelSlug, 'AI Bullet Optimization');
    const cleaned = String(reply).replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1));
  } catch (err) {
    console.error('AI Bullet Optimization failed, keeping originals:', err.message);
  }

  const allowed = buildAllowed(resumeText);
  ids.forEach((id) => {
    const orig = bulletMap.original[id];
    const value = parsed[id];
    const candidate = typeof value === 'string' ? value : (value && value.text) || '';
    const check = validateEdit(orig, candidate, resumeText, allowed);
    if (check.ok) optimized[id] = candidate.replace(/\s+/g, ' ').trim();
    else {
      optimized[id] = orig;
      if (candidate && !check.reasons.includes('unchanged')) rejected[id] = check.reasons;
    }
  });

  return { optimized, rejected, skippedKeywords: skipped };
};

const reconstructStructuredJSON = (parsed, bulletMap, optimizedMap) => {
  const copy = JSON.parse(JSON.stringify(parsed));
  const fresh = createBulletMap(copy);
  Object.keys(fresh.original).forEach((id) => {
    const text = optimizedMap[id];
    if (!text) return;
    const m = fresh.meta[id];
    if (m && m.ref && Array.isArray(m.ref.bullets)) {
      m.ref.bullets[m.index] = text;
    }
  });
  return copy;
};

module.exports = { createBulletMap, optimizeBulletsWithAI, reconstructStructuredJSON };