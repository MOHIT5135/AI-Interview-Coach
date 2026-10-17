'use strict';
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

const renderResumeToPDF = async (resumeData, outputPath) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    const htmlTemplate = fs.readFileSync(path.join(__dirname, '../templates/resumeTemplate.html'), 'utf8');
    const template = handlebars.compile(htmlTemplate);
    const html = template(resumeData);

    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0in', bottom: '0in', left: '0in', right: '0in' }
    });
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = { renderResumeToPDF };