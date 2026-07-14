const { Schema, model } = require('mongoose');

// Stored on local disk rather than Cloudinary, same reasoning as generated
// documents/salary slips: PDFs delivered without our own auth gate hit
// Cloudinary's raw-file delivery restriction. Served back through an
// authenticated admin route instead of a direct URL.
const clientUploadedDocumentSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    clientDocumentRequest: { type: Schema.Types.ObjectId, ref: 'ClientDocumentRequest', required: true },
    slotIndex: { type: Number, required: true },
    docLabel: { type: String, required: true },
    originalFilename: String,
    mimeType: String,
    sizeBytes: Number,
    filePath: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = model('ClientUploadedDocument', clientUploadedDocumentSchema);
