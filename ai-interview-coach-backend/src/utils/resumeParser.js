'use strict';
/**
 * resumeParser.js
 * Deterministic, layout-aware resume parser. No AI.
 *
 * Why this exists: pdf-parse returns plain text only. Hyperlinks in a PDF are stored as
 * link annotations (a URL plus a rectangle), not as text, so they never appear in the text.
 * This parser reads the text items WITH positions and the link annotations, rebuilds lines,
 * splits sections / entries / bullets, and keeps every fact (links, dates, CGPA, skills lines)
 * exactly as written.
 *
 * Requires: pdfjs-dist (v4+), Node 20+.   npm i pdfjs-dist
 * Limits: single-column layouts work best; scanned (image-only) PDFs return no text.
 */
const path = require('path');

// ---------- pdfjs loading (ESM package from CommonJS) ----------
let pdfjsPromise = null;
const loadPdfjs = () => {
  if (!pdfjsPromise) {
    try {
      pdfjsPromise = Promise.resolve(require('pdfjs-dist/build/pdf.js'));
    } catch (e) {
      pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
    }
  }
  return pdfjsPromise;
};

const fontDataUrl = () => {
  try {
    const pkg = require.resolve('pdfjs-dist/package.json');
    return path.join(path.dirname(pkg), 'standard_fonts') + path.sep;
  } catch (e) {
    return undefined;
  }
};

// ---------- small helpers ----------
const SOCIAL_LABELS = {
  linkedin: 'LinkedIn', github: 'GitHub', leetcode: 'LeetCode', gitlab: 'GitLab',
  kaggle: 'Kaggle', medium: 'Medium', behance: 'Behance', stackoverflow: 'StackOverflow',
  twitter: 'Twitter', codeforces: 'Codeforces', codechef: 'CodeChef', hackerrank: 'HackerRank',
};

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
};

const labelFromUrl = (url, fallback = 'Link') => {
  if (/^mailto:/i.test(url)) return 'Email';
  const host = hostOf(url);
  const first = host.split('.')[0].toLowerCase();
  return SOCIAL_LABELS[first] || fallback;
};

const ensureProtocol = (u) => {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^(https?:|mailto:)/i.test(s)) return s;
  return `https://${s.replace(/^\/\//, '')}`;
};

const normSpace = (s) => String(s || '').replace(/[  -​﻿]/g, ' ').replace(/\s+/g, ' ').trim();

const normLigatures = (s) => String(s || '')
  .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff')
  .replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl');

// ---------- 1. Extract positioned lines + link annotations ----------
const extractLines = async (buffer) => {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    standardFontDataUrl: fontDataUrl(),
    isEvalSupported: false,
    verbosity: 0,
  }).promise;

  const allLines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const annots = await page.getAnnotations();

    const items = tc.items
      .filter((it) => typeof it.str === 'string' && it.str.trim() !== '')
      .map((it) => ({
        str: normLigatures(it.str),
        x: it.transform[4],
        y: it.transform[5],
        w: it.width || 0,
        h: Math.abs(it.transform[3]) || it.height || 9,
        links: [],
      }));

    // --- link annotations -> label text + owning item ---
    const links = annots
      .filter((a) => a.subtype === 'Link' && (a.url || a.unsafeUrl))
      .map((a) => ({ url: String(a.url || a.unsafeUrl).trim(), rect: a.rect }));

    for (const lk of links) {
      const minX = Math.min(lk.rect[0], lk.rect[2]);
      const maxX = Math.max(lk.rect[0], lk.rect[2]);
      const minY = Math.min(lk.rect[1], lk.rect[3]);
      const maxY = Math.max(lk.rect[1], lk.rect[3]);
      const parts = [];
      for (const it of items) {
        const cy = it.y + it.h * 0.3;
        if (cy < minY - 1.5 || cy > maxY + 1.5) continue;
        const ox1 = Math.max(it.x, minX);
        const ox2 = Math.min(it.x + it.w, maxX);
        if (ox2 - ox1 <= 0.5 || it.w <= 0) continue;
        const n = it.str.length;
        let s = Math.round(((ox1 - it.x) / it.w) * n);
        let e = Math.round(((ox2 - it.x) / it.w) * n);
        s = Math.max(0, Math.min(n, s));
        e = Math.max(s, Math.min(n, e));
        // expand to whole words (character widths are estimated)
        while (s > 0 && /\w/.test(it.str[s - 1]) && /\w/.test(it.str[s] || '')) s--;
        while (e < n && /\w/.test(it.str[e - 1]) && /\w/.test(it.str[e])) e++;
        parts.push({ x: it.x, text: it.str.slice(s, e), item: it });
      }
      parts.sort((a, b) => a.x - b.x);
      const label = normSpace(parts.map((q) => q.text).join(' '))
        .replace(/^[\s(|,·•:;\[]+/, '').replace(/[\s)|,·•:;.\]]+$/, '');
      if (parts.length) {
        parts[0].item.links.push({ url: lk.url, label });
      } else {
        // icon-only link: attach to the nearest line by vertical position
        const cy = (minY + maxY) / 2;
        let best = null;
        for (const it of items) {
          const d = Math.abs(it.y - cy);
          if (!best || d < best.d) best = { d, it };
        }
        if (best) best.it.links.push({ url: lk.url, label: '' });
      }
    }

    // --- group items into lines ---
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const groups = [];
    for (const it of items) {
      const last = groups[groups.length - 1];
      const tol = Math.max(2, it.h * 0.35);
      if (last && Math.abs(last.y - it.y) <= tol) last.items.push(it);
      else groups.push({ y: it.y, items: [it] });
    }
    for (const g of groups) {
      g.items.sort((a, b) => a.x - b.x);
      let text = '';
      const segs = [];
      let seg = '';
      g.items.forEach((it, i) => {
        if (i > 0) {
          const prev = g.items[i - 1];
          const gap = it.x - (prev.x + prev.w);
          const size = prev.h || 9;
          const needSpace = gap > 0.12 * size && !/\s$/.test(text) && !/^\s/.test(it.str);
          if (needSpace) { text += ' '; seg += ' '; }
          if (gap > 2.5 * size) { segs.push(normSpace(seg)); seg = ''; }
        }
        text += it.str;
        seg += it.str;
      });
      segs.push(normSpace(seg));
      const lineLinks = [];
      g.items.forEach((it) => it.links.forEach((l) => lineLinks.push(l)));
      allLines.push({
        text: normSpace(text),
        segs: segs.filter(Boolean),
        x: g.items[0].x,
        y: g.y,
        size: Math.max(...g.items.map((it) => it.h)),
        page: p,
        links: lineLinks,
      });
    }
  }
  return allLines.filter((l) => l.text);
};

// ---------- 2. Patterns ----------
const MON = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
const YEAR = '(?:19|20)\\d{2}';
const POINT = `(?:${MON}\\s+)?${YEAR}`;
const END = `(?:Present|Current|Now|Ongoing|${POINT})`;
const RANGE_RE = new RegExp(`${POINT}\\s*(?:–|—|-|to)\\s*${END}`, 'i');
const MONTH_YEAR_RE = new RegExp(`${MON}\\s+${YEAR}`, 'i');
const YEAR_RE = new RegExp(`\\b${YEAR}\\b`);

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/;
const URL_RE = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?!js\b)[a-z]{2,6}(?:\/[^\s|,;()]*)?/i;

const BULLET_RE = /^[•‣◦⁃∙▪●○■►➢–—\-*-]\s*/;
const isBulletStart = (t) => BULLET_RE.test(t) && /^[^\w]{1,2}\s*\S/.test(t) && !/^\d/.test(t);
const stripBullet = (t) => normSpace(t.replace(BULLET_RE, ''));

// Heading vocabulary: resume section words only (not skills or technologies).
const HEADINGS = {
  summary: ['summary', 'professional summary', 'profile', 'objective', 'career objective', 'about me', 'about', 'executive summary'],
  skills: ['skills', 'technical skills', 'core competencies', 'key skills', 'technologies', 'expertise', 'tech stack', 'technical expertise'],
  experience: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'internships', 'internship experience', 'work history', 'relevant experience'],
  projects: ['projects', 'personal projects', 'academic projects', 'key projects', 'selected projects', 'project experience'],
  education: ['education', 'academic background', 'academics', 'qualifications', 'education and training', 'academic qualifications'],
  other: ['certifications', 'certificates', 'achievements', 'awards', 'honors', 'honours', 'publications', 'languages', 'interests', 'hobbies', 'volunteering', 'volunteer experience', 'activities', 'extracurricular', 'extracurricular activities', 'coursework', 'positions of responsibility', 'leadership', 'training', 'courses'],
};

const headingKind = (text) => {
  const t = text.toLowerCase().replace(/[^a-z& ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.split(' ').length > 4 || text.length > 40) return null;
  for (const kind of Object.keys(HEADINGS)) {
    if (HEADINGS[kind].includes(t)) return kind;
  }
  return null;
};

// ---------- 3. Link label stripping + date finding ----------
const cleanSeparators = (s) => normSpace(
  String(s || '')
    .replace(/\(\s*[|,·\/]*\s*\)/g, ' ')
    .replace(/\(\s*$/, ' ')
    .replace(/^\s*\)/, ' ')
    .replace(/(?:\s*[|·]\s*){2,}/g, ' | ')
    .replace(/^[\s|,;·•–—-]+/, '')
    .replace(/[\s|,;·•–—-]+$/, '')
);

const stripLinkLabels = (text, links) => {
  let t = text;
  (links || []).forEach((l) => {
    if (!l.label) return;
    const idx = t.lastIndexOf(l.label);
    if (idx >= 0) t = t.slice(0, idx) + ' ' + t.slice(idx + l.label.length);
  });
  return cleanSeparators(t);
};

// Finds a date at the START or END of a line (header lines carry dates there).
const findHeaderDate = (text, allowYear = false) => {
  const tryRe = (re) => {
    const m = text.match(re);
    if (!m) return null;
    const start = m.index;
    const end = m.index + m[0].length;
    const atEnd = end >= text.length - 2;
    const atStart = start <= 2;
    if (!atEnd && !atStart) return null;
    return { date: normSpace(m[0]), rest: cleanSeparators(text.slice(0, start) + ' ' + text.slice(end)) };
  };
  return tryRe(RANGE_RE) || tryRe(MONTH_YEAR_RE) || (allowYear ? tryRe(YEAR_RE) : null);
};

// removes ONE trailing "Label:" word (for example "Graduation:") left in front of a removed date
const stripTrailingLabel = (s) => normSpace(String(s || '').replace(/\s+[A-Za-z]{3,20}:\s*$/, '').replace(/^[A-Za-z]{3,20}:\s*$/, ''));

const urlKey = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const looksLikeUrlText = (s) => /\//.test(s) || (!/\s/.test(s) && /\./.test(s));

const addLink = (list, link) => {
  const url = ensureProtocol(link.url);
  if (!url) return;
  const key = urlKey(url);
  if (list.some((l) => urlKey(l.url) === key)) return;
  let label = String(link.label || '').trim();
  if (!label || looksLikeUrlText(label)) label = labelFromUrl(url, 'Website');
  list.push({ label, url });
};

// ---------- soft-hyphen repair (line-end hyphenation such as "re-" + "quirements") ----------
let CURRENT_VOCAB = null;

// Words that appear inside lines (not split across a line end) tell us how this resume spells things.
const buildVocab = (lines) => {
  const full = new Set();
  const parts = new Set();
  const hyph = new Set();
  lines.forEach((l) => {
    const toks = l.text.split(/\s+/);
    toks.forEach((tok, i) => {
      if (i === toks.length - 1 && /-$/.test(tok)) return;
      const t = tok.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
      if (!t) return;
      if (t.includes('-')) { hyph.add(t); t.split('-').forEach((q) => q && parts.add(q)); } else full.add(t);
    });
  });
  return { full, parts, hyph };
};

// Joins a wrapped line onto the previous text. Removes the hyphen only when it is a soft break.
const joinLines = (prev, next) => {
  const v = CURRENT_VOCAB;
  const a = String(prev || '').match(/([A-Za-z]+)-$/);
  const b = String(next || '').match(/^([a-z]+)/);
  if (!v || !a || !b) return normSpace(`${prev} ${next}`);
  const f1 = a[1].toLowerCase();
  const f2 = b[1];
  let keep;
  if (v.full.has(f1 + f2)) keep = false;
  else if (v.hyph.has(`${f1}-${f2}`)) keep = true;
  else if (f1.length <= 2) keep = false;
  else if (v.parts.has(f1)) keep = true;
  else keep = false;
  return normSpace((keep ? prev : prev.slice(0, -1)) + next);
};

// ---------- 4. Section parsers ----------
const parseHeader = (lines) => {
  const header = { name: '', headline: '', email: '', phone: '', links: [], extras: [] };
  if (!lines.length) return header;
  header.name = lines[0].text.replace(/[-]/g, '').trim();

  const GARBAGE = /(^|\s)[ïÐ§-](?=\s|$)/g;
  const labelsSeen = new Set();
  const rest = lines.slice(1);

  // links + email + phone
  rest.forEach((ln) => {
    ln.links.forEach((l) => {
      if (/^mailto:/i.test(l.url)) { header.email = header.email || l.url.replace(/^mailto:/i, ''); }
      else { addLink(header.links, l); if (l.label) labelsSeen.add(l.label); }
    });
  });
  const joined = rest.map((l) => l.text).join(' | ');
  header.email = header.email || ((joined.match(EMAIL_RE) || [''])[0]);
  header.phone = (joined.replace(EMAIL_RE, ' ').match(PHONE_RE) || [''])[0].trim();

  // plain-text URLs (e.g. "GitHub: github.com/name") when the PDF has no link annotation
  rest.forEach((ln) => {
    const noEmail = ln.text.replace(EMAIL_RE, ' ');
    ln.segs.flatMap((s) => s.split(/\s*[|•·]\s*/)).forEach((seg) => {
      const s = seg.replace(EMAIL_RE, ' ');
      const m = s.match(URL_RE);
      if (m && /[/]|^https?:|www\./i.test(m[0]) || (m && /\.(app|io|dev|me|in|com|net|org|co|ai|xyz|tech)$/i.test(m[0]))) {
        const lab = s.match(/^\s*([A-Za-z ]{2,20}):\s*/);
        addLink(header.links, { url: m[0], label: (lab && lab[1].trim()) || labelFromUrl(ensureProtocol(m[0]), 'Website') });
      }
    });
    void noEmail;
  });

  // headline + extras (location etc.)
  let headlineTaken = false;
  rest.forEach((ln) => {
    const hasContact = EMAIL_RE.test(ln.text) || PHONE_RE.test(ln.text) || ln.links.length > 0;
    const cleaned = ln.text.replace(GARBAGE, '$1');
    if (!hasContact && !headlineTaken && !URL_RE.test(cleaned.replace(EMAIL_RE, ''))) {
      header.headline = normSpace(cleaned); headlineTaken = true; return;
    }
    ln.segs.flatMap((s) => s.replace(GARBAGE, '$1').split(/\s*[|•·]\s*/)).forEach((seg) => {
      const s = normSpace(seg);
      if (!s) return;
      if (EMAIL_RE.test(s) || (PHONE_RE.test(s) && s.replace(PHONE_RE, '').trim().length < 3)) return;
      if (header.links.some((l) => l.label === s)) return;
      if (labelsSeen.has(s)) return;
      if (/^[A-Za-z ]{2,20}:\s*\S+\.[a-z]{2,}/i.test(s) || URL_RE.test(s) && /\//.test(s)) return;
      if (/^[ïÐ§-]+$/.test(s)) return;
      header.extras.push(s);
    });
  });
  return header;
};

const parseSkills = (lines) => {
  const items = [];
  lines.forEach((ln) => {
    const t = stripBullet(ln.text);
    const m = t.match(/^([^:]{2,45}):\s*(.+)$/);
    if (m && !/^https?/i.test(m[1])) items.push({ category: normSpace(m[1]), items: normSpace(m[2]) });
    else if (items.length) items[items.length - 1].items = joinLines(items[items.length - 1].items, t);
    else items.push({ category: '', items: t });
  });
  return items;
};

const parseEntries = (lines) => {
  if (!lines.length) return [];
  const entries = [];
  let cur = null;
  let last = null; // 'header' | 'subtitle' | 'bullet'

  const newEntry = (title = '', date = '') => {
    cur = { title, date, subtitle: '', links: [], bullets: [] };
    entries.push(cur);
  };
  const attach = (ln) => ln.links.forEach((l) => addLink(cur.links, l));

  lines.forEach((ln) => {
    const raw = ln.text;
    const clean = stripLinkLabels(raw, ln.links);
    const dm = findHeaderDate(clean);

    if (dm) {
      newEntry(dm.rest, dm.date);
      attach(ln);
      last = 'header';
      return;
    }

    if (!cur) {
      newEntry(clean, '');
      attach(ln);
      last = 'header';
      return;
    }

    if (last === 'header') {
      cur.subtitle = clean;
      attach(ln);
      last = 'subtitle';
      return;
    }

    // Subsequent lines belong to bullets of the current entry
    if (isBulletStart(raw)) {
      cur.bullets.push(stripBullet(raw));
    } else {
      if (cur.bullets.length > 0 && last === 'bullet') {
        cur.bullets[cur.bullets.length - 1] = joinLines(cur.bullets[cur.bullets.length - 1], clean);
      } else {
        cur.bullets.push(clean);
      }
    }
    attach(ln);
    last = 'bullet';
  });
  return entries;
};

const METRIC_RE = /\b(?:CGPA|GPA|SGPA|Percentage|Score)\s*[:\-]?\s*[\d.]+(?:\s*\/\s*[\d.]+)?\s*%?/i;

const parseEducation = (lines) => {
  const entries = [];
  let cur = null;
  lines.forEach((ln) => {
    const clean = stripLinkLabels(ln.text, ln.links);
    const dm = findHeaderDate(clean, true);
    const metricMatch = clean.match(METRIC_RE);
    const metric = metricMatch ? normSpace(metricMatch[0]) : '';
    const noMetric = metric ? cleanSeparators(clean.replace(METRIC_RE, ' ')) : clean;

    if (dm) {
      const rest = stripTrailingLabel(dm.rest.replace(METRIC_RE, ' '));
      if (cur && !cur.lines.length && !cur.date) {
        cur.date = dm.date;
        if (rest) cur.lines.push(rest);
        if (metric) cur.metric = metric;
      } else {
        cur = { title: rest, date: dm.date, lines: [], metric };
        entries.push(cur);
      }
      return;
    }
    if (!cur) {
      cur = { title: noMetric, date: '', lines: [], metric };
      entries.push(cur);
      return;
    }
    if (noMetric) cur.lines.push(noMetric);
    if (metric) cur.metric = cur.metric ? `${cur.metric} | ${metric}` : metric;
  });
  return entries;
};

const parseOther = (lines) => {
  const items = [];
  lines.forEach((ln) => {
    if (isBulletStart(ln.text)) items.push(stripBullet(ln.text));
    else if (items.length) items[items.length - 1] = joinLines(items[items.length - 1], ln.text);
    else items.push(normSpace(ln.text));
  });
  return items;
};

// ---------- 5. Public API ----------
const parseResumeBuffer = async (buffer) => {
  const lines = await extractLines(buffer);
  if (!lines.length) return { ok: false, reason: 'no_text', text: '', header: null, blocks: [] };
  CURRENT_VOCAB = buildVocab(lines);

  // split into header + sections
  let firstHeading = lines.findIndex((l) => headingKind(l.text));
  if (firstHeading < 0) firstHeading = lines.length;
  const header = parseHeader(lines.slice(0, firstHeading));

  const blocks = [];
  let cur = null;
  lines.slice(firstHeading).forEach((ln) => {
    const kind = headingKind(ln.text);
    if (kind) {
      cur = { kind, title: ln.text.replace(/:$/, ''), lines: [] };
      blocks.push(cur);
    } else if (cur) {
      cur.lines.push(ln);
    }
  });

  const out = blocks.map((b) => {
    const base = { title: b.title, kind: b.kind };
    switch (b.kind) {
      case 'summary':
        return { ...base, isSummary: true, text: b.lines.map((l) => l.text).reduce((acc, t) => (acc ? joinLines(acc, t) : t), '') };
      case 'skills':
        return { ...base, isSkills: true, items: parseSkills(b.lines) };
      case 'experience':
        return { ...base, isExperience: true, entries: parseEntries(b.lines) };
      case 'projects':
        return { ...base, isProjects: true, entries: parseEntries(b.lines) };
      case 'education':
        return { ...base, isEducation: true, entries: parseEducation(b.lines) };
      default:
        return { ...base, isOther: true, items: parseOther(b.lines) };
    }
  });

  CURRENT_VOCAB = null;
  const text = lines.map((l) => l.text).join('\n');
  const linkCount = header.links.length
    + out.reduce((n, b) => n + (b.entries ? b.entries.reduce((m, e) => m + (e.links ? e.links.length : 0), 0) : 0), 0);
  return { ok: out.length > 0, reason: out.length ? '' : 'no_sections', text, header, blocks: out, stats: { lines: lines.length, links: linkCount } };
};

// All experience/project bullets in reading order, with a stable reference.
const collectBullets = (parsed) => {
  const list = [];
  (parsed.blocks || []).forEach((b) => {
    if (!b.entries || !(b.isExperience || b.isProjects)) return;
    b.entries.forEach((e) => e.bullets.forEach((text, i) => list.push({
      section: b.isProjects ? 'Projects' : 'Experience', entry: e.title, index: i, text, ref: e,
    })));
  });
  return list;
};

const keyOf = (s) => normSpace(s).toLowerCase();

// Replace bullets in the parsed structure. Matches by exact normalized text only.
const applyBulletEdits = (parsed, edits) => {
  const map = new Map();
  (edits || []).forEach((e) => {
    if (e && e.originalBullet && e.suggestedBullet) map.set(keyOf(e.originalBullet), normSpace(e.suggestedBullet));
  });
  let applied = 0;
  (parsed.blocks || []).forEach((b) => {
    if (!b.entries) return;
    b.entries.forEach((e) => {
      if (!e.bullets) return;
      e.bullets = e.bullets.map((t) => {
        const rep = map.get(keyOf(t));
        if (rep) { applied += 1; return rep; }
        return t;
      });
    });
  });
  return { parsed, applied, requested: map.size };
};

module.exports = { parseResumeBuffer, collectBullets, applyBulletEdits, extractLines, isBulletStart, findHeaderDate };
