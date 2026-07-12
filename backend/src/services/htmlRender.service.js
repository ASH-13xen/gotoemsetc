const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
// v149 ships as ESM with a default export — required via CJS, the actual
// module lands under `.default` rather than on the top-level object.
const chromium = require('@sparticuz/chromium').default;
const puppeteer = require('puppeteer-core');
const ApiError = require('../utils/ApiError');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Same single-brace {tag} syntax as the docx pipeline (docxRender.service.js)
// — values are HTML-escaped since they're being spliced into markup rather
// than a Word XML run. Any {tag} left unfilled after substitution means a
// required field is genuinely missing, mirroring docxtemplater's
// nullGetter-based "missing tags" error so both pipelines fail the same way.
function fillTemplate(html, data) {
  const missingTags = new Set();

  // Loop sections use the same {#loopKey}...{/loopKey} shape docxtemplater
  // uses, so a template's loops[] data (see mergeData.service.js's
  // buildLoopData — e.g. `responsibilities`) renders identically whichever
  // pipeline the template is on. Resolved first so the inner {itemField}
  // tags don't get caught by the flat single-tag pass below.
  const withLoopsRendered = html.replace(/\{#(\w+)\}([\s\S]*?)\{\/\1\}/g, (_match, loopKey, inner) => {
    const items = Array.isArray(data[loopKey]) ? data[loopKey] : [];
    return items
      .map((item) =>
        inner.replace(/\{([a-zA-Z0-9_]+)\}/g, (itemMatch, itemKey) => {
          if (!(itemKey in item) || item[itemKey] === undefined || item[itemKey] === null) return itemMatch;
          return escapeHtml(item[itemKey]);
        })
      )
      .join('');
  });

  const filled = withLoopsRendered.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (!(key in data) || data[key] === undefined || data[key] === null) {
      missingTags.add(key);
      return match;
    }
    return escapeHtml(data[key]);
  });

  if (missingTags.size > 0) {
    throw ApiError.badRequest('Missing values for required fields', {
      missingTags: [...missingTags],
    });
  }

  return filled;
}

// One headless browser instance, reused across requests — this is a
// long-running server process (not per-request serverless), so launching
// fresh for every document would be wasteful. @sparticuz/chromium is a
// compressed Chromium build meant for memory-constrained hosts (Render free
// tier), used via puppeteer-core rather than full `puppeteer` to avoid
// bundling a second, heavier Chromium download.
let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }
  return browserPromise;
}

// Renders by writing the filled HTML to a temp file *inside* the template's
// own directory and navigating to it via file:// — this makes relative
// asset paths (e.g. `assets/logo.png`) resolve exactly the way they would
// if you just double-clicked the template file open in a browser, so
// previewing a template edit needs no special tooling.
async function renderPdfFromHtml(html, templateDir) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  const tempFile = path.join(templateDir, `.render-${crypto.randomUUID()}.html`);

  try {
    await fs.writeFile(tempFile, html, 'utf8');
    await page.goto(`file://${tempFile}`, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
    });
  } finally {
    await page.close();
    await fs.unlink(tempFile).catch(() => {});
  }
}

module.exports = { fillTemplate, renderPdfFromHtml };
