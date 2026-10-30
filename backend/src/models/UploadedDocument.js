const { Schema, model } = require('mongoose');

// Not on Cloudinary — PDFs delivered without our own auth gate hit its
// raw-file delivery restriction — so served back through an authenticated
// route instead of a direct URL. The file itself is kept here (`data`): the
// server's own disk is wiped on every deploy, which lost the files of
// documents uploaded before this (`filePath` is where those were).
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
    data: { type: Buffer, select: false },
  },
  { timestamps: true }
);

// The file never goes out with the record.
const withoutData = { transform: (_doc, ret) => { delete ret.data; return ret; } };
uploadedDocumentSchema.set('toJSON', withoutData);
uploadedDocumentSchema.set('toObject', withoutData);

module.exports = model('UploadedDocument', uploadedDocumentSchema);
