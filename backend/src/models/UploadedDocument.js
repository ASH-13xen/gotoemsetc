const { Schema, model } = require('mongoose');

const uploadedDocumentSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    uploadRequest: { type: Schema.Types.ObjectId, ref: 'UploadRequest', required: true },
    docType: { type: String, required: true },
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
