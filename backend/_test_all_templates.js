require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const env = require('./src/config/env');
const DocumentTemplate = require('./src/models/DocumentTemplate');
const { fillTemplate } = require('./src/services/htmlRender.service');

const chromiumPath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const puppeteer = require('puppeteer-core');

async function main() {
  await mongoose.connect(env.mongodbUri);
  const keys = ['nda', 'hr-policies'];
  const templates = await DocumentTemplate.find({ key: { $in: keys } });

  const browser = await puppeteer.launch({ executablePath: chromiumPath, headless: true });
  const outDir = 'C:/tmp/doc_extract/rendered';

  for (const template of templates) {
    const mergeData = { employeeName: 'Test Employee', effectiveDate: '1 July 2026' };
    const templateHtml = fs.readFileSync(path.join(env.templatesHtmlDir, template.htmlFilePath), 'utf8');
    const filledHtml = fillTemplate(templateHtml, mergeData);

    const page = await browser.newPage();
    const tempFile = path.join(env.templatesHtmlDir, `.test-${template.key}.html`);
    fs.writeFileSync(tempFile, filledHtml, 'utf8');
    await page.goto(`file://${tempFile}`, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' } });
    fs.writeFileSync(path.join(outDir, `${template.key}.pdf`), pdf);
    await page.close();
    fs.unlinkSync(tempFile);
    console.log(`OK ${template.key}`);
  }

  await browser.close();
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
