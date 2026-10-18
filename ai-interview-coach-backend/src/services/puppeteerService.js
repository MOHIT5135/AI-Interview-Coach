'use strict';
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

const getChromePath = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const paths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
};

const renderResumeToPDF = async (resumeData, outputPath) => {
  let browser;
  try {
    const executablePath = getChromePath();
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      executablePath: executablePath
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
