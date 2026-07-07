const path = require('node:path');
const cloudinary = require('../config/cloudinary');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const MIME_EXTENSIONS = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// Cloudinary's `raw` resource type serves whatever extension is in the
// public_id verbatim (unlike `image`/`auto`, which infer it) — this picks
// one from the original filename, falling back to the MIME type.
function extensionFor(originalFilename, mimeType) {
  const fromName = path.extname(originalFilename || '');
  if (fromName) return fromName.toLowerCase();
  return MIME_EXTENSIONS[mimeType] || '';
}

function uploadBuffer(buffer, { folder, publicId, resourceType = 'raw' }) {
  if (!env.cloudinaryConfigured) {
    throw ApiError.internal('Cloudinary is not configured. Set CLOUDINARY_* env vars.');
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: resourceType, overwrite: false },
      (err, result) => {
        if (err) {
          // Cloudinary's own validation failures (corrupt/invalid file
          // content) are the uploader's fault, not ours — surface as 400.
          reject(ApiError.badRequest(err.message || 'Could not process this file', { http_code: err.http_code }));
          return;
        }
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

function destroy(publicId, { resourceType = 'raw' } = {}) {
  if (!env.cloudinaryConfigured) return Promise.resolve();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

module.exports = { uploadBuffer, destroy, extensionFor };
