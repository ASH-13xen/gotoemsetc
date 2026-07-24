const { Schema, model } = require('mongoose');

const uploadedDocumentSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    // Absent for documents an admin attached directly (see
    // uploadedDocument.service.js#adminUpload) rather than an employee
    // fulfilling a request link.
    uploadRequest: { type: Schema.Types.ObjectId, ref: 'UploadRequest' },
    docType: { type: String, required: true },
    // Only meaningful when docType is 'other' — the free-text name the
    // uploader typed in place of a fixed doc type label.
    otherLabel: { type: String, trim: true },
    originalFilename: String,
    mimeType: String,
    sizeBytes: Number,
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    // Cloudinary's actual resolved type (image/video/raw) — 'auto' is an
    // upload-time hint only and isn't a valid value when destroying an asset.
    resourceType: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = model('UploadedDocument', uploadedDocumentSchema);
