'use strict';
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Preserves newlines (\n), indents, and cleanly normalizes punctuation
const sanitizePreservedText = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/≈/g, '~')
    .replace(/•/g, '*')
    .replace(/[^\x20-\x7E\t\n]/g, ' ')
    .trim();
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

  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  const writeStream = fs.createWriteStream(filepath);
  doc.pipe(writeStream);

  const PRIMARY = '#4f46e5';
  const GREEN = '#10b981';
  const AMBER = '#f59e0b';
  const DARK = '#0f172a';
  const GRAY_BG = '#f8fafc';
  const GRAY_BORDER = '#e2e8f0';

  const overallScore = safeNum(sessionData.overallScore).toFixed(1);
  let dateStr = 'N/A';
  try { dateStr = new Date(sessionData.createdAt).toLocaleDateString(); } catch(e) {}

  // ================= PAGE 1 =================
  doc.rect(0, 0, 612, 110).fill(PRIMARY);
  doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold');
  doc.text('AI Interview Coach', 0, 30, { width: 612, align: 'center' });
  doc.fontSize(13).font('Helvetica');
  doc.text('Performance Evaluation Report', 0, 65, { width: 612, align: 'center' });

  // Metadata Box
  doc.roundedRect(40, 130, 370, 95, 8).fillAndStroke(GRAY_BG, GRAY_BORDER);
  doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold');
  doc.text('Target Role: ' + (sessionData.role || 'N/A'), 55, 148);
  doc.fontSize(11).font('Helvetica');
  doc.text('Seniority Level: ' + (sessionData.difficulty || 'N/A'), 55, 172);
  doc.text('Date of Session: ' + dateStr, 55, 192);

  // Score Badge
  doc.roundedRect(430, 130, 142, 95, 8).fillAndStroke(overallScore >= 7.5 ? '#f0fdf4' : '#fffbeb', overallScore >= 7.5 ? '#bbf7d0' : '#fde68a');
  doc.fillColor(overallScore >= 7.5 ? '#15803d' : '#b45309').fontSize(38).font('Helvetica-Bold');
  doc.text(overallScore, 430, 145, { width: 142, align: 'center' });
  doc.fontSize(12).font('Helvetica');
  doc.text('Overall Score / 10', 430, 190, { width: 142, align: 'center' });

  // Strengths
  doc.y = 250;
  doc.fillColor('#15803d').fontSize(14).font('Helvetica-Bold').text('Key Strengths & Competencies', 40, doc.y);
  doc.strokeColor('#bbf7d0').lineWidth(1.2).moveTo(40, doc.y + 4).lineTo(572, doc.y + 4).stroke();
  doc.moveDown(0.8);
  doc.fillColor(DARK).fontSize(9.5).font('Helvetica');
  (sessionData.strengths || []).forEach((s) => {
    doc.text('•  ' + sanitizePreservedText(s), { indent: 10, lineGap: 2 });
  });

  // Areas for Improvement
  doc.moveDown(1.2);
  doc.fillColor('#b91c1c').fontSize(14).font('Helvetica-Bold').text('Priority Areas for Technical Improvement', 40, doc.y);
  doc.strokeColor('#fecaca').lineWidth(1.2).moveTo(40, doc.y + 4).lineTo(572, doc.y + 4).stroke();
  doc.moveDown(0.8);
  doc.fillColor(DARK).fontSize(9.5).font('Helvetica');
  (sessionData.weaknesses || []).forEach((w) => {
    doc.text('•  ' + sanitizePreservedText(w), { indent: 10, lineGap: 2 });
  });

  // ================= Q&A REVIEW =================
  doc.addPage();
  doc.fillColor(PRIMARY).fontSize(16).font('Helvetica-Bold').text('Question-by-Question Diagnostic Review', 40, 40);
  doc.strokeColor(PRIMARY).lineWidth(1.2).moveTo(40, doc.y + 4).lineTo(572, doc.y + 4).stroke();
  doc.moveDown(1.5);

  const cardWidth = 532;

  qaPairs.forEach((qa, idx) => {
    if (doc.y > 660) {
      doc.addPage();
      doc.y = 40;
    }

    const score = safeNum(qa.score);
    const scoreColor = score >= 8 ? '#15803d' : score >= 6 ? '#b45309' : '#b91c1c';

    // Question Header & Score
    doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold');
    doc.text(`Q${idx + 1}: ${sanitizePreservedText(qa.question)}`, 40, doc.y, { continued: true, width: 440 });
    doc.fillColor(scoreColor).text(`  Score: ${score}/10`, { align: 'right' });
    doc.moveDown(0.5);

    // Candidate Answer (Preserves Structure & Paragraph Breaks)
    doc.fillColor(DARK).fontSize(9.5).font('Helvetica-Bold').text('Candidate Answer:', 40, doc.y);
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(9).fillColor('#334155').text(
      sanitizePreservedText(qa.userAnswer) || '[No response provided]',
      45,
      doc.y,
      { width: 520, lineGap: 2 }
    );
    doc.moveDown(0.8);

    // 1. GOOD POINTS (Eye-Pleasing Green UI Card)
    if (qa.goodPoints && qa.goodPoints.length > 0) {
      let greenContentHeight = 16;
      doc.fontSize(8.5).font('Helvetica');
      qa.goodPoints.forEach(gp => {
        greenContentHeight += doc.heightOfString(`• ${gp}`, { width: cardWidth - 24 }) + 3;
      });
      const greenCardHeight = greenContentHeight + 14;

      if (doc.y + greenCardHeight > 760) doc.addPage();

      const gY = doc.y;
      doc.roundedRect(40, gY, cardWidth, greenCardHeight, 6).fillAndStroke('#f0fdf4', '#bbf7d0');

      doc.fillColor('#15803d').fontSize(9).font('Helvetica-Bold').text('What You Did Well (Good Points):', 52, gY + 8);
      let gTextY = gY + 22;
      doc.fillColor('#14532d').fontSize(8.5).font('Helvetica');
      qa.goodPoints.forEach(gp => {
        doc.text(`• ${sanitizePreservedText(gp)}`, 52, gTextY, { width: cardWidth - 24, lineGap: 1.5 });
        gTextY += doc.heightOfString(`• ${gp}`, { width: cardWidth - 24 }) + 3;
      });

      doc.y = gY + greenCardHeight + 8;
    }

    // 2. MISSING / GAPS (Distinct Red UI Card)
    if (qa.missingPoints && qa.missingPoints.length > 0) {
      let redContentHeight = 16;
      doc.fontSize(8.5).font('Helvetica');
      qa.missingPoints.forEach(mp => {
        redContentHeight += doc.heightOfString(`• ${mp}`, { width: cardWidth - 24 }) + 3;
      });
      const redCardHeight = redContentHeight + 14;

      if (doc.y + redCardHeight > 760) doc.addPage();

      const rY = doc.y;
      doc.roundedRect(40, rY, cardWidth, redCardHeight, 6).fillAndStroke('#fef2f2', '#fecaca');

      doc.fillColor('#b91c1c').fontSize(9).font('Helvetica-Bold').text('Areas for Improvement (Missing Details):', 52, rY + 8);
      let rTextY = rY + 22;
      doc.fillColor('#7f1d1d').fontSize(8.5).font('Helvetica');
      qa.missingPoints.forEach(mp => {
        doc.text(`• ${sanitizePreservedText(mp)}`, 52, rTextY, { width: cardWidth - 24, lineGap: 1.5 });
        rTextY += doc.heightOfString(`• ${mp}`, { width: cardWidth - 24 }) + 3;
      });

      doc.y = rY + redCardHeight + 8;
    }

    // 3. Ideal Answer Guide
    if (qa.idealAnswerHint) {
      if (doc.y > 700) doc.addPage();
      doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text('Ideal Answer Guide:', 40, doc.y);
      doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(sanitizePreservedText(qa.idealAnswerHint), 45, doc.y + 2, { width: 520, lineGap: 1.5 });
      doc.moveDown(0.6);
    }

    doc.strokeColor(GRAY_BORDER).lineWidth(0.5).moveTo(40, doc.y).lineTo(572, doc.y).stroke();
    doc.moveDown(1.2);
  });

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => setTimeout(() => resolve(filepath), 100));
    writeStream.on('error', reject);
  });
};

module.exports = { generatePDFReport };