const { Schema, model } = require('mongoose');

// Stored on local disk rather than Cloudinary, same reasoning as generated
// documents/salary slips/client documents: PDFs delivered without our own
// auth gate hit Cloudinary's raw-file delivery restriction. Served back
// through an authenticated route instead of a direct URL.
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
    filePath: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = model('UploadedDocument', uploadedDocumentSchema);
