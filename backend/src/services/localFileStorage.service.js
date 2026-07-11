const fs = require('node:fs/promises');
const path = require('node:path');

// Cloudinary's account-level security default blocks unauthenticated delivery
// of PDF/ZIP raw files entirely (plain and signed URLs both 401) — rather
// than depend on a dashboard toggle we don't have access to, these files are
// stored on our own disk and served through our own routes. `namespace`
// keeps each feature's files in their own subfolder (quotations, salary
// slips, ...) under the same shared storage root.
const STORAGE_ROOT = path.join(__dirname, '..', '..', 'storage');

async function saveBuffer(buffer, relativePath, namespace = 'quotations') {
  const absolutePath = path.join(STORAGE_ROOT, namespace, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return relativePath;
}

function readBuffer(relativePath, namespace = 'quotations') {
  return fs.readFile(path.join(STORAGE_ROOT, namespace, relativePath));
}

function absolutePathFor(relativePath, namespace = 'quotations') {
  return path.join(STORAGE_ROOT, namespace, relativePath);
}

// Best-effort — a missing file (already deleted, never written) shouldn't
// block whatever record-deletion flow called this.
function deleteFile(relativePath, namespace = 'quotations') {
  return fs.unlink(absolutePathFor(relativePath, namespace)).catch(() => {});
}

module.exports = { saveBuffer, readBuffer, absolutePathFor, deleteFile };
