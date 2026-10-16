'use strict';
/**
 * aiEditor.js  (drop-in replacement; same exported names as before)
 *
 * The model rewrites WORDING of complete bullets only. Code owns every fact.
 * Bullets come from resumeParser (full multi-line bullets, not single PDF lines).
 */
const { collectBullets } = require('./resumeParser');
const { validateEdit, splitKeywordsByPresence, buildAllowed } = require('./bulletGuard');

const MAX_BULLETS = 16;

// bulletMap = { original: {id: text}, meta: {id: {section, entry, ref, index}} }
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
  return `You are a resume editor. Rewrite each bullet to read clearer and stronger for the target role "${targetRole}" WITHOUT changing any facts.

RULES:
1. Use ONLY facts, technologies, tools, numbers and names that already appear in that same bullet. Do not add any technology, tool, metric, employer, title or responsibility.
2. Keep every number, percentage and unit exactly as written.
3. You may improve only: action verb, clarity, concision and result-first phrasing. Keep the length within about 30% of the original.
4. Emphasis keywords that already exist in the resume: ${JSON.stringify(usableKeywords)}. Foreground one ONLY if the bullet already mentions it. Never insert a keyword that is not already in the bullet.
5. If a bullet is already strong, return it unchanged.

Return ONLY a JSON object: {"<id>": "<rewritten bullet>"} using the ids below.

BULLETS:
${list}`;
};

// attested = keywords the user explicitly ticked as "I have really used this" (never auto-filled).
const optimizeBulletsWithAI = async (bulletMap, targetRole, keywords, callOpenRouter, getModel, resumeBaseText = '', attested = []) => {
  const resumeText = `${resumeBaseText}\n${(attested || []).join(' ')}`;
  const optimized = {};
  const rejected = {};
  const ids = Object.keys(bulletMap.original);
  if (!ids.length) return { optimized, rejected, skippedKeywords: [] };

  const { usable, skipped } = splitKeywordsByPresence(keywords, resumeText);
  let parsed = {};
  try {
    const reply = await callOpenRouter(buildPrompt(bulletMap, targetRole, usable), 0.2, getModel(), 'AI Bullet Optimization');
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
      optimized[id] = orig; // always fall back to the original bullet, never to empty text
      if (candidate && !check.reasons.includes('unchanged')) rejected[id] = check.reasons;
    }
  });
  return { optimized, rejected, skippedKeywords: skipped };
};

// Returns a deep copy of the parsed resume with accepted bullets replaced.
const reconstructStructuredJSON = (parsed, bulletMap, optimizedMap) => {
  const copy = JSON.parse(JSON.stringify(parsed));
  const fresh = createBulletMap(copy);
  Object.keys(fresh.original).forEach((id) => {
    const text = optimizedMap[id];
    if (!text) return;
    const m = fresh.meta[id];
    m.ref.bullets[m.index] = text;
  });
  return copy;
};

module.exports = { createBulletMap, optimizeBulletsWithAI, reconstructStructuredJSON };
