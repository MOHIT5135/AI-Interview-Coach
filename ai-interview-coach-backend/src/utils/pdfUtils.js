const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const HEADER_DICTIONARY = {
  experience: /^(?:professional\s+|work\s+)?(?:experience|history)|employment(?:\s+history)?$/i,
  projects: /^(?:academic\s+|personal\s+|open\s+source\s+)?projects?$/i,
  skills: /^(?:technical\s+|core\s+|computer\s+)?skills|technologies|competencies$/i,
  education: /^education|academic\s+background$/i,
  summary: /^(?:professional\s+|executive\s+)?(?:summary|profile|objective)$/i,
  certifications: /^certifications|licenses$/i
};

function detectSectionHeader(line) {
  const trimmedLine = line.trim();
  if (trimmedLine.length === 0 || trimmedLine.length > 40) return null;
  if (/^[-•*·◾]/.test(trimmedLine)) return null;
  if (trimmedLine.endsWith('.')) return null;

  for (const [sectionKey, regex] of Object.entries(HEADER_DICTIONARY)) {
    if (regex.test(trimmedLine)) {
      return sectionKey;
    }
  }
  return null;
}

function parseResumeSections(rawText) {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const resumeData = {
    contact_info: [],
    summary: [],
    experience: [],
    projects: [],
    skills: [],
    education: [],
    certifications: [],
    unmapped: []
  };

  let currentSection = 'contact_info';

  lines.forEach(line => {
    const rawLine = line.trim();
    if (!rawLine) return;

    const detectedHeader = detectSectionHeader(rawLine);
    if (detectedHeader) {
      currentSection = detectedHeader;
    } else {
      if (resumeData[currentSection]) {
        resumeData[currentSection].push(rawLine);
      } else {
        resumeData.unmapped.push(rawLine);
      }
    }
  });

  return resumeData;
}

async function extractSpatialText(buffer) {
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  let textItems = [];
  let embeddedLinks = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const pageWidth = viewport.width;

    content.items.forEach(item => {
      if (!item.str.trim()) return;
      textItems.push({
        text: item.str.trim(),
        x: item.transform[4],
        y: item.transform[5],
        page: i,
        pageWidth: pageWidth
      });
    });

    try {
      const annotations = await page.getAnnotations();
      annotations.forEach(anno => {
        if (anno.subtype === 'Link' && anno.url) {
          embeddedLinks.push(anno.url);
        }
      });
    } catch (annoErr) {
      // Ignore annotation extraction errors gracefully
    }
  }
  return { textItems, embeddedLinks };
}

function sequenceMultiColumnResume(textItems) {
  const leftColumn = [];
  const rightColumn = [];

  textItems.forEach(item => {
    const splitThreshold = item.pageWidth * 0.40;
    if (item.x < splitThreshold) {
      leftColumn.push(item);
    } else {
      rightColumn.push(item);
    }
  });

  const sortByVerticalPosition = (a, b) => {
    if (Math.abs(b.y - a.y) < 5) {
      return a.x - b.x;
    }
    return b.y - a.y;
  };

  leftColumn.sort(sortByVerticalPosition);
  rightColumn.sort(sortByVerticalPosition);

  const rightText = rightColumn.map(item => item.text).join('\n');
  const leftText = leftColumn.map(item => item.text).join('\n');

  return rightText + '\n\n' + leftText;
}

async function processResumePDF(pdfBuffer) {
  // Step 1: Extract text with X, Y coordinates and embedded links
  const { textItems, embeddedLinks } = await extractSpatialText(pdfBuffer);

  // Step 2: Fix 2-column layouts into a linear string
  let linearText = sequenceMultiColumnResume(textItems);

  // Append embedded links to ensure they are captured by text parsing/regexes
  if (embeddedLinks && embeddedLinks.length > 0) {
    linearText += '\n' + embeddedLinks.join(' ');
  }

  // Step 3: Run the Regex dictionary & section parser
  const parsedJsonTree = parseResumeSections(linearText);

  return {
    parsedJsonTree,
    embeddedLinks,
    linearText,
    structuredJSON: parseResumeToStructuredJSON(linearText, embeddedLinks)
  };
}

const parsePdfBuffer = async (buffer) => {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args.some(arg => typeof arg === 'string' && arg.includes('standardFontDataUrl'))) return;
    originalWarn(...args);
  };
  try {
    const { textItems, embeddedLinks } = await extractSpatialText(buffer);
    if (textItems && textItems.length > 0) {
      let linear = sequenceMultiColumnResume(textItems);
      if (embeddedLinks && embeddedLinks.length > 0) {
        linear += '\n' + embeddedLinks.join(' ');
      }
      return linear;
    }

    const pdfParseModule = require('pdf-parse');
    let text = '';
    if (typeof pdfParseModule === 'string' || typeof pdfParseModule === 'function') {
      const data = await pdfParseModule(buffer);
      text = data.text || '';
    } else if (pdfParseModule.default) {
      const data = await pdfParseModule.default(buffer);
      text = data.text || '';
    } else if (pdfParseModule.PDFParse) {
      const uint8 = new Uint8Array(buffer);
      const parser = new pdfParseModule.PDFParse(uint8);
      await parser.load();
      const res = await parser.getText();
      text = typeof res === 'string' ? res : (res.text || '');
    } else {
      const data = await pdfParseModule(buffer);
      text = data.text || '';
    }
    return text;
  } catch (err) {
    console.error('Failed to parse PDF resume with spatial extraction, falling back:', err);
    const pdfParseModule = require('pdf-parse');
    const data = await pdfParseModule(buffer);
    return data.text || '';
  } finally {
    console.warn = originalWarn;
  }
};

const parseResumeToStructuredJSON = (resumeText, embeddedLinks = []) => {
  const sections = parseResumeSections(resumeText);
  const cleaned = String(resumeText || '');

  const allTextAndLinks = cleaned + ' ' + embeddedLinks.join(' ');
  const emailMatch = allTextAndLinks.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const phoneMatch = allTextAndLinks.match(/\+?\d[\d\s().-]{8,}\d/);
  const linkedinMatch = allTextAndLinks.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+/i);
  const githubMatch = allTextAndLinks.match(/https?:\/\/(?:www\.)?github\.com\/[\w-]+/i);
  const portfolioMatch = allTextAndLinks.match(/https?:\/\/(?:www\.)?(?!linkedin|github|leetcode)[\w.-]+\.[a-z]{2,}(?:\/[^\s]*)?/i);

  const contactLines = [...sections.contact_info, ...(sections.summary.slice(0, 2))];
  const name = contactLines.length > 0 && contactLines[0].length < 40 ? contactLines[0] : 'Candidate';

  const dynamicSkillsObj = {};
  sections.skills.forEach(line => {
    if (line.includes(':')) {
      const [category, ...rest] = line.split(':');
      dynamicSkillsObj[category.trim()] = rest.join(':').trim();
    } else {
      if (!dynamicSkillsObj["General"]) dynamicSkillsObj["General"] = [];
      if (Array.isArray(dynamicSkillsObj["General"])) {
        dynamicSkillsObj["General"].push(line);
      } else {
        dynamicSkillsObj["General"] = [dynamicSkillsObj["General"], line];
      }
    }
  });

  return {
    name,
    email: emailMatch ? emailMatch[0] : '',
    phone: phoneMatch ? phoneMatch[0] : '',
    linkedin: linkedinMatch ? linkedinMatch[0] : '',
    github: githubMatch ? githubMatch[0] : '',
    portfolio: portfolioMatch ? portfolioMatch[0] : '',
    summary: sections.summary.join(' '),
    skills: dynamicSkillsObj,
    experience: sections.experience,
    projects: sections.projects,
    education: sections.education
  };
};

module.exports = {
  HEADER_DICTIONARY,
  detectSectionHeader,
  parseResumeSections,
  extractSpatialText,
  sequenceMultiColumnResume,
  processResumePDF,
  parsePdfBuffer,
  parseResumeToStructuredJSON
};
