const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const cleanText = (text) => {
  if (!text) return '';
  return String(text).replace(/[^\x20-\x7E\n\t]/g, ' ').trim();
};

// Layout: Overleaf-style matched to LaTeX
const renderLatexMatch = (doc, resumeData) => {
  let data;
  try {
    data = typeof resumeData === 'string' ? JSON.parse(resumeData) : resumeData;
  } catch (e) {
    doc.text('Error: Could not parse resume structure.');
    return;
  }

  // Header - Mimicking LaTeX layout
  doc.fontSize(24).font('Helvetica-Bold').text(data.name || 'Mohit Kumar', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(14).font('Helvetica-Bold').text(data.role || 'Software Developer', { align: 'center' });
  doc.moveDown(0.4);

  // Contact Info
  doc.fontSize(9).font('Helvetica').text(data.contact || '+91-9636568730 | mohitk87975@gmail.com | LinkedIn | Github | Portfolio', { align: 'center' });
  doc.moveDown(1.2);

  // Section helper
  const renderSection = (title) => {
    doc.moveDown(0.2);
    doc.fontSize(12).font('Helvetica-Bold').text(title.toUpperCase());
    doc.strokeColor('black').lineWidth(0.5).moveTo(50, doc.y + 2).lineTo(562, doc.y + 2).stroke();
    doc.moveDown(0.6);
  };

  // Summary
  if (data.summary) {
    renderSection('Summary');
    doc.fontSize(10).font('Helvetica').text(data.summary, { align: 'justify', paragraphGap: 5 });
  }

  // Skills
  if (data.skills) {
    renderSection('Skills');
    for (const [key, items] of Object.entries(data.skills)) {
      doc.fontSize(10).font('Helvetica-Bold').text(`${key}: `, { continued: true });
      doc.font('Helvetica').text(items.join(', '));
      doc.moveDown(0.2);
    }
  }

  // Experience
  if (data.experience) {
    renderSection('Experience');
    data.experience.forEach(exp => {
      doc.fontSize(10).font('Helvetica-Bold').text(`${exp.title}`, { continued: true });
      doc.text(exp.date, { align: 'right' });
      doc.fontSize(10).font('Helvetica-Oblique').text(exp.company);
      exp.bullets.forEach(b => doc.fontSize(9).font('Helvetica').text(`• ${b}`, { indent: 10, paragraphGap: 2 }));
      doc.moveDown(0.4);
    });
  }

  // Projects
  if (data.projects) {
    renderSection('Projects');
    data.projects.forEach(proj => {
      doc.fontSize(10).font('Helvetica-Bold').text(`${proj.name} | ${proj.links}`, { continued: true });
      doc.text(proj.date, { align: 'right' });
      proj.bullets.forEach(b => doc.fontSize(9).font('Helvetica').text(`• ${b}`, { indent: 10, paragraphGap: 2 }));
      doc.moveDown(0.4);
    });
  }

  // Education
  if (data.education) {
    renderSection('Education');
    data.education.forEach(edu => {
      doc.fontSize(10).font('Helvetica-Bold').text(`${edu.degree}`, { continued: true });
      doc.text(edu.date, { align: 'right' });
      doc.fontSize(10).font('Helvetica').text(edu.institution);
      doc.moveDown(0.2);
    });
  }
};

const TEMPLATES = {
  overleaf: renderLatexMatch
};

const generateOptimizedResumePDF = async (optimizedText, templateName = 'overleaf', downloadDir = './reports') => {
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const filename = `Optimized_Resume_${Date.now()}.pdf`;
  const filepath = path.join(downloadDir, filename);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const writeStream = fs.createWriteStream(filepath);
  doc.pipe(writeStream);

  // Default to overleaf now
  const renderFn = TEMPLATES.overleaf;
  renderFn(doc, optimizedText);

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => setTimeout(() => resolve(filepath), 200));
    writeStream.on('error', reject);
  });
};

module.exports = { generatePDFReport: require('./reportService').generatePDFReport, generateOptimizedResumePDF };
