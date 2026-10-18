'use strict';
const { collectBullets } = require('./resumeParser');
const { validateEdit, splitKeywordsByPresence, buildAllowed } = require('./bulletGuard');
const { callGeminiAI, getModel: defaultGetModel } = require('../services/aiService');

const MAX_BULLETS = 16;

const createBulletMap = (parsed) => {
  const original = {};
  const meta = {};
  let expCount = 0;
  let projCount = 0;

  collectBullets(parsed).slice(0, MAX_BULLETS).forEach((b) => {
    const isExp = b.section === 'Experience';
    const id = isExp ? `exp_${expCount++}` : `proj_${projCount++}`;
    original[id] = b.text;
    meta[id] = { section: b.section, entry: b.entry, ref: b.ref, index: b.index };
  });
  return { original, meta };
};

const buildPrompt = (bulletMap, targetRole, usableKeywords) => {
  const list = Object.keys(bulletMap.original).map((id) => `${id}: ${bulletMap.original[id]}`).join('\n');
  return `You are an expert resume editor. Rewrite each bullet to read clearer and stronger for the target role "${targetRole}" WITHOUT changing any facts.

RULES:
1. Use ONLY facts, technologies, tools, numbers and names that already appear in that same bullet. Do not add any new technology, tool, metric, employer, or title.
2. Keep every number, percentage, and unit exactly as written.
3. You may improve only: action verb, clarity, concision, and result-first phrasing (Google X-Y-Z formula: Accomplished X as measured by Y by doing Z). Keep the length within 30% of the original.
4. Keywords present in the resume: ${JSON.stringify(usableKeywords)}. Emphasize them ONLY if already mentioned in that bullet.
5. If a bullet is already strong, return it unchanged.

Return ONLY a valid JSON object in this format: {"<id>": "<rewritten bullet>"} using the exact IDs below:

BULLETS:
${list}`;
};

const optimizeBulletsWithAI = async (
  bulletMap,
  targetRole,
  keywords,
  callAiFn = callGeminiAI,
  getModelFn = defaultGetModel,
  resumeBaseText = '',
  attested = []
) => {
  const resumeText = `${resumeBaseText}\n${(attested || []).join(' ')}`;
  const optimized = {};
  const rejected = {};
  const ids = Object.keys(bulletMap.original);
  if (!ids.length) return { optimized, rejected, skippedKeywords: [] };

  const { usable, skipped } = splitKeywordsByPresence(keywords, resumeText);
  let parsed = {};

  try {
    const aiCaller = typeof callAiFn === 'function' ? callAiFn : callGeminiAI;
    const modelGetter = typeof getModelFn === 'function' ? getModelFn : defaultGetModel;
    const reply = await aiCaller(buildPrompt(bulletMap, targetRole, usable), 0.2, modelGetter(), 'AI Bullet Optimization');
    const cleaned = String(reply).replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    }
  } catch (err) {
    console.error('AI Bullet Optimization parse failure, keeping originals:', err.message);
  }

  const allowed = buildAllowed(resumeText);
  ids.forEach((id) => {
    const orig = bulletMap.original[id];
    const candidate = typeof parsed[id] === 'string' ? parsed[id] : (parsed[id]?.text || '');
    const check = validateEdit(orig, candidate, resumeText, allowed);
    if (check.ok) {
      optimized[id] = candidate.replace(/\s+/g, ' ').trim();
    } else {
      optimized[id] = orig;
      if (candidate && !check.reasons.includes('unchanged')) {
        rejected[id] = check.reasons;
      }
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