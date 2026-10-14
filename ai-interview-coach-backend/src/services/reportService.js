const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLibDoc } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const cleanText = (text) => {
  if (!text) return '';
  return String(text).replace(/[^\x20-\x7E\n\t]/g, ' ').trim();
};

const safeNum = (val) => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const generatePDFReport = async (sessionId, sessionData, qaPairs, downloadDir = './reports') => {
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const filename = `report_${sessionId}_${new Date().toISOString().split('T')[0]}.pdf`;
  const filepath = path.join(downloadDir, filename);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const writeStream = fs.createWriteStream(filepath);
  doc.pipe(writeStream);

  const PRIMARY = '#4f46e5';
  const GREEN = '#10b981';
  const AMBER = '#f59e0b';
  const DARK = '#1f2937';
  const GRAY_BG = '#f3f4f6';
  const GRAY_LINE = '#e5e7eb';

  const overallScore = safeNum(sessionData.overallScore).toFixed(1);
  let dateStr = 'N/A';
  try { dateStr = new Date(sessionData.createdAt).toLocaleDateString(); } catch(e) {}

  // ====== PAGE 1 ======

  // Indigo header banner
  doc.rect(0, 0, 612, 120).fill(PRIMARY);
  doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold');
  doc.text('AI Interview Coach', 0, 35, { width: 612, align: 'center' });
  doc.fontSize(14).font('Helvetica');
  doc.text('Performance Report', 0, 70, { width: 612, align: 'center' });

  // Info box
  doc.roundedRect(50, 145, 360, 100, 6).fill(GRAY_BG);
  doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold');
  doc.text('Role:  ' + (sessionData.role || 'N/A'), 70, 165);
  doc.fontSize(12).font('Helvetica');
  doc.text('Difficulty:  ' + (sessionData.difficulty || 'N/A'), 70, 190);
  doc.text('Date:  ' + dateStr, 70, 210);

  // Score badge
  doc.roundedRect(430, 145, 130, 100, 10).fill(GREEN);
  doc.fillColor('#ffffff').fontSize(42).font('Helvetica-Bold');
  doc.text(overallScore, 430, 165, { width: 130, align: 'center' });
  doc.fontSize(14).font('Helvetica');
  doc.text('out of 10', 430, 210, { width: 130, align: 'center' });

  // Strengths
  doc.y = 280;
  doc.fillColor(GREEN).fontSize(16).font('Helvetica-Bold');
  doc.text('Key Strengths', 50, 280);
  const lineY1 = doc.y + 4;
  doc.strokeColor(GREEN).lineWidth(1.5).moveTo(50, lineY1).lineTo(560, lineY1).stroke();
  doc.y = lineY1 + 12;

  doc.fillColor(DARK).fontSize(11).font('Helvetica');
  (sessionData.strengths || []).forEach((s) => {
    doc.text('  -  ' + cleanText(s), 55, doc.y, { width: 490 });
    doc.y += 6;
  });

  // Weaknesses
  doc.y += 16;
  doc.fillColor(AMBER).fontSize(16).font('Helvetica-Bold');
  doc.text('Areas for Improvement', 50, doc.y);
  const lineY2 = doc.y + 4;
  doc.strokeColor(AMBER).lineWidth(1.5).moveTo(50, lineY2).lineTo(560, lineY2).stroke();
  doc.y = lineY2 + 12;

  doc.fillColor(DARK).fontSize(11).font('Helvetica');
  (sessionData.weaknesses || []).forEach((w) => {
    doc.text('  -  ' + cleanText(w), 55, doc.y, { width: 490 });
    doc.y += 6;
  });

  // ====== PAGE 2+: Q&A ======
  doc.addPage();
  doc.fillColor(PRIMARY).fontSize(18).font('Helvetica-Bold');
  doc.text('Question-by-Question Review', 50, 50);
  const lineY3 = doc.y + 4;
  doc.strokeColor(PRIMARY).lineWidth(1.5).moveTo(50, lineY3).lineTo(560, lineY3).stroke();
  doc.y = lineY3 + 20;

  qaPairs.forEach((qa, idx) => {
    if (doc.y > 680) {
      doc.addPage();
      doc.y = 50;
    }

    const score = safeNum(qa.score);
    const sc = score >= 8 ? GREEN : score >= 6 ? AMBER : '#ef4444';

    // Question header
    doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold');
    doc.text('Q' + (idx + 1) + ':  ' + cleanText(qa.question), 50, doc.y, { width: 440 });

    // Score inline
    doc.fillColor(sc).fontSize(11).font('Helvetica-Bold');
    doc.text('Score: ' + score + '/10', 50, doc.y, { width: 510, align: 'right' });
    doc.y += 8;

    // Your Answer
    doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold');
    doc.text('Your Answer:', 50, doc.y);
    doc.y += 2;
    doc.fillColor(DARK).fontSize(9).font('Helvetica');
    doc.text(cleanText(qa.userAnswer), 55, doc.y, { width: 490 });
    doc.y += 8;

    // Good Points
    doc.fillColor(GREEN).fontSize(9).font('Helvetica-Bold');
    doc.text('Good Points:', 50, doc.y);
    doc.fillColor(DARK).fontSize(8).font('Helvetica');
    (qa.goodPoints || []).forEach((gp) => {
      doc.text('  -  ' + cleanText(gp), 55, doc.y, { width: 490 });
    });
    doc.y += 4;

    // Missing Points
    doc.fillColor(AMBER).fontSize(9).font('Helvetica-Bold');
    doc.text('Missing Points:', 50, doc.y);
    doc.fillColor(DARK).fontSize(8).font('Helvetica');
    (qa.missingPoints || []).forEach((mp) => {
      doc.text('  -  ' + cleanText(mp), 55, doc.y, { width: 490 });
    });
    doc.y += 4;

    // Ideal Answer
    doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold');
    doc.text('Ideal Answer:', 50, doc.y);
    doc.fillColor(DARK).fontSize(8).font('Helvetica');
    doc.text(cleanText(qa.idealAnswerHint), 55, doc.y, { width: 490 });

    doc.y += 20;
    doc.strokeColor(GRAY_LINE).lineWidth(0.5).moveTo(50, doc.y).lineTo(560, doc.y).stroke();
    doc.y += 16;
  });

  // Footer
  doc.fillColor('#9ca3af').fontSize(9).font('Helvetica');
  doc.text('Generated by AI Interview Coach', 0, doc.page.height - 40, { width: 612, align: 'center' });

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => setTimeout(() => resolve(filepath), 200));
    writeStream.on('error', reject);
  });
};

const generateOptimizedResumePDF = async (originalPdfBuffer, optimizedText, downloadDir = './reports') => {
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const pdfDoc = await PDFLibDoc.load(originalPdfBuffer);
  const optimizedPage = pdfDoc.addPage();
  optimizedPage.drawText(cleanText(optimizedText), {
    x: 50,
    y: 700,
    size: 11,
  });

  const pdfBytes = await pdfDoc.save();
  const filename = `Optimized_Resume_${Date.now()}.pdf`;
  const filepath = path.join(downloadDir, filename);

  fs.writeFileSync(filepath, pdfBytes);
  return filepath;
};

module.exports = { generatePDFReport, generateOptimizedResumePDF };
