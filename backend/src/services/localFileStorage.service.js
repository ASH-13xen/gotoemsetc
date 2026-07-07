const fs = require('node:fs/promises');
const path = require('node:path');

// Cloudinary's account-level security default blocks unauthenticated delivery
// of PDF/ZIP raw files entirely (plain and signed URLs both 401) — rather
// than depend on a dashboard toggle we don't have access to, quotation PDFs
// are stored on our own disk and served through our own routes.
const STORAGE_ROOT = path.join(__dirname, '..', '..', 'storage', 'quotations');

async function saveBuffer(buffer, relativePath) {
  const absolutePath = path.join(STORAGE_ROOT, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return relativePath;
}

function readBuffer(relativePath) {
  return fs.readFile(path.join(STORAGE_ROOT, relativePath));
}

function absolutePathFor(relativePath) {
  return path.join(STORAGE_ROOT, relativePath);
}

module.exports = { saveBuffer, readBuffer, absolutePathFor };
