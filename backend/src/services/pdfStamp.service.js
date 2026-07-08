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

// position is {page, xPct, yPct, widthPct, heightPct} — all fractions (0-1)
// of the page, xPct/yPct measured from the top-left, matching how the
// frontend mapper's drag-to-draw box is captured. Converts to pdf-lib's
// bottom-left point space, returning the box's bottom-left corner plus size
// so drawing helpers can fit/center content inside it rather than stamping
// at a bare point.
function toPageBox(page, position) {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const width = position.widthPct * pageWidth;
  const height = position.heightPct * pageHeight;
  const x = position.xPct * pageWidth;
  const y = pageHeight - (position.yPct + position.heightPct) * pageHeight;
  return { x, y, width, height };
}

const TEXT_PADDING = 3;
const MIN_FONT_SIZE = 6;

// Auto-fits text inside the box: starts from a size derived from the box's
// height and shrinks until it fits the box's width, so the same field looks
// right whether it's a short "$500" or a long client name. Left-aligned
// with a small padding, vertically centered in the box.
function drawFieldText(page, font, text, position, { color = rgb(0, 0, 0) } = {}) {
  if (!text) return;
  const box = toPageBox(page, position);
  const str = String(text);
  const maxSize = Math.max(MIN_FONT_SIZE, box.height * 0.7);
  const maxTextWidth = Math.max(0, box.width - TEXT_PADDING * 2);

  let size = maxSize;
  while (size > MIN_FONT_SIZE && font.widthOfTextAtSize(str, size) > maxTextWidth) {
    size -= 0.5;
  }

  const x = box.x + TEXT_PADDING;
  const y = box.y + (box.height - size) / 2 + size * 0.15; // nudge for font baseline
  page.drawText(str, { x, y, size, font, color });
}

// Sizes the "X" to fill most of the box (whichever dimension is tighter),
// centered both horizontally and vertically.
function drawCheckmark(page, font, position) {
  const box = toPageBox(page, position);
  const size = Math.max(MIN_FONT_SIZE, Math.min(box.width, box.height) * 0.8);
  const textWidth = font.widthOfTextAtSize('X', size);
  const x = box.x + (box.width - textWidth) / 2;
  const y = box.y + (box.height - size) / 2 + size * 0.15;
  page.drawText('X', { x, y, size, font, color: rgb(0, 0, 0) });
}

// Scales the signature PNG to fit within the box (preserving aspect ratio,
// never upscaling past its native size) and centers it both horizontally
// and vertically within the box.
async function drawSignatureImage(pdfDoc, page, position, pngBuffer) {
  const box = toPageBox(page, position);
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  const scale = Math.min(box.width / pngImage.width, box.height / pngImage.height, 1);
  const width = pngImage.width * scale;
  const height = pngImage.height * scale;
  const x = box.x + (box.width - width) / 2;
  const y = box.y + (box.height - height) / 2;
  page.drawImage(pngImage, { x, y, width, height });
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
