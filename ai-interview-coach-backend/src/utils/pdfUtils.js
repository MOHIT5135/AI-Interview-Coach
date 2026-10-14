const parsePdfBuffer = async (buffer) => {
  try {
    const pdfParseModule = require('pdf-parse');
    if (typeof pdfParseModule === 'function') {
      const data = await pdfParseModule(buffer);
      return data.text || '';
    } else if (pdfParseModule.PDFParse) {
      const uint8 = new Uint8Array(buffer);
      const parser = new pdfParseModule.PDFParse(uint8);
      await parser.load();
      const res = await parser.getText();
      return typeof res === 'string' ? res : (res.text || '');
    }
  } catch (err) {
    console.error('Failed to parse PDF resume:', err);
  }
  return '';
};

module.exports = { parsePdfBuffer };
