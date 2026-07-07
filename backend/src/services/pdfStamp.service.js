const fs = require('node:fs/promises');
const path = require('node:path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates', 'quotations');

function templatePdfPath(pdfFilename) {
  return path.join(TEMPLATES_DIR, pdfFilename);
}

function dataUrlToBuffer(dataUrl) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

async function getPageCount(pdfFilename) {
  const bytes = await fs.readFile(templatePdfPath(pdfFilename));
  const pdfDoc = await PDFDocument.load(bytes);
  return pdfDoc.getPageCount();
}

// position is {page, xPct, yPct} — xPct/yPct are fractions (0-1) from the
// top-left of the page, matching how the frontend mapper captures clicks.
function toPagePoint(page, position) {
  const { width, height } = page.getSize();
  return { x: position.xPct * width, y: height - position.yPct * height };
}

function drawFieldText(page, font, text, position, { size = 11, color = rgb(0, 0, 0) } = {}) {
  if (!text) return;
  const { x, y } = toPagePoint(page, position);
  page.drawText(String(text), { x, y, size, font, color });
}

function drawCheckmark(page, font, position, { size = 12 } = {}) {
  const { x, y } = toPagePoint(page, position);
  page.drawText('X', { x, y, size, font, color: rgb(0, 0, 0) });
}

// Draws a signature PNG anchored so its top-left corner sits at the
// calibrated position, scaled down to fit within a fixed box while keeping
// its aspect ratio (signatures are rarely the same shape as the box).
async function drawSignatureImage(pdfDoc, page, position, pngBuffer, { maxWidth = 130, maxHeight = 45 } = {}) {
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  const scale = Math.min(maxWidth / pngImage.width, maxHeight / pngImage.height, 1);
  const width = pngImage.width * scale;
  const height = pngImage.height * scale;
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const x = position.xPct * pageWidth;
  const topY = pageHeight - position.yPct * pageHeight;
  page.drawImage(pngImage, { x, y: topY - height, width, height });
}

// Builds the initial quotation PDF: client name / brand name / date filled
// in and the chosen plan's checkbox marked. Nothing is signed yet.
async function generateQuotationPdf(template, { clientName, brandName, date, planOptionKey }) {
  const bytes = await fs.readFile(templatePdfPath(template.pdfFilename));
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const fields = template.fields || {};

  const nameText = template.combinedNameBrand
    ? [clientName, brandName].filter(Boolean).join(' / ')
    : clientName;

  if (fields.clientName) drawFieldText(pages[fields.clientName.page], font, nameText, fields.clientName);
  if (fields.brandName && !template.combinedNameBrand) {
    drawFieldText(pages[fields.brandName.page], font, brandName, fields.brandName);
  }
  if (fields.date && date) {
    drawFieldText(pages[fields.date.page], font, new Date(date).toLocaleDateString('en-IN'), fields.date);
  }

  if (template.planType !== 'fixed' && planOptionKey && Array.isArray(fields.planCheckboxes)) {
    const optionIndex = template.planOptions.findIndex((o) => o.key === planOptionKey);
    const checkboxPosition = fields.planCheckboxes[optionIndex];
    if (checkboxPosition) drawCheckmark(pages[checkboxPosition.page], boldFont, checkboxPosition);
  }

  if (template.planType === 'fixed' && fields.totalPayableAmount && template.fixedAmount) {
    drawFieldText(
      pages[fields.totalPayableAmount.page],
      font,
      `Rs. ${template.fixedAmount.toLocaleString('en-IN')}/-`,
      fields.totalPayableAmount
    );
  }

  return Buffer.from(await pdfDoc.save());
}

// Stamps a signature image onto an existing (already-generated) quotation
// PDF buffer — used for both the admin's signature and, later, the client's.
async function stampSignature(pdfBuffer, position, signaturePngDataUrl) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const page = pdfDoc.getPages()[position.page];
  const pngBuffer = dataUrlToBuffer(signaturePngDataUrl);
  await drawSignatureImage(pdfDoc, page, position, pngBuffer);
  return Buffer.from(await pdfDoc.save());
}

module.exports = { getPageCount, generateQuotationPdf, stampSignature, templatePdfPath };
