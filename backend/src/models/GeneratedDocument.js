const { Schema, model } = require('mongoose');
const { GENERATED_DOCUMENT_STATUS } = require('../config/constants');

const fileRefSchema = new Schema(
  { url: String, publicId: String, bytes: Number },
  { _id: false }
);

// Cloudinary's account-level security default blocks unauthenticated
// delivery of PDF/ZIP raw files entirely (see localFileStorage.service.js)
// — PDFs generated from HTML templates are stored on our own disk and
// served through an authenticated route instead, so this needs a different
// shape than the Cloudinary-backed `docx` field.
const localFileRefSchema = new Schema({ filePath: String }, { _id: false });

const generatedDocumentSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    template: { type: Schema.Types.ObjectId, ref: 'DocumentTemplate', required: true },
    templateVersion: Number,
    mergeDataSnapshot: Schema.Types.Mixed,
    docx: fileRefSchema,
    pdf: localFileRefSchema,
    status: {
      type: String,
      enum: Object.values(GENERATED_DOCUMENT_STATUS),
      default: GENERATED_DOCUMENT_STATUS.COMPLETED,
    },
    errorMessage: String,
  },
  { timestamps: true }
);

module.exports = model('GeneratedDocument', generatedDocumentSchema);
