const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

const renderResumeToPDF = async (resumeData, outputPath) => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  // Load template
  const htmlTemplate = fs.readFileSync(path.join(__dirname, '../templates/resumeTemplate.html'), 'utf8');
  const template = handlebars.compile(htmlTemplate);
  const html = template(resumeData);

  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' }
  });

  await browser.close();
};

module.exports = { renderResumeToPDF };
