const { Schema, model } = require('mongoose');
const { GENERATED_DOCUMENT_STATUS } = require('../config/constants');

// Generated files are stored as bytes directly on the document rather than
// in Cloudinary or on local disk: Cloudinary blocks unauthenticated delivery
// of PDF/raw files by account-level default, and Render's free-tier disk is
// wiped on every redeploy/restart. Mongo is already the durable store for
// everything else in this app, and these files are small (a few hundred KB).
// `data` is excluded by default from list/detail reads (see
// generatedDocument.repository.js) and only loaded for the download route.
const fileSchema = new Schema(
  { data: Buffer, contentType: String, filename: String },
  { _id: false }
);

const generatedDocumentSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    template: { type: Schema.Types.ObjectId, ref: 'DocumentTemplate', required: true },
    templateVersion: Number,
    mergeDataSnapshot: Schema.Types.Mixed,
    docx: fileSchema,
    pdf: fileSchema,
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
