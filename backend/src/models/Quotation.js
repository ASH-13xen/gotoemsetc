const { Schema, model } = require('mongoose');
const { QUOTATION_STATUS } = require('../config/constants');

// Stored on our own disk (see localFileStorage.service) rather than
// Cloudinary — this account's security defaults block unauthenticated
// delivery of raw PDF/ZIP files entirely, so we serve these ourselves.
const fileRefSchema = new Schema({ filePath: { type: String, required: true } }, { _id: false });

const quotationSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    template: { type: Schema.Types.ObjectId, ref: 'QuotationTemplate', required: true },
    // Each new quotation for a client supersedes the previous one — version
    // is purely informational/display, supersession is tracked via status.
    version: { type: Number, required: true },
    planOptionKey: { type: String },
    status: {
      type: String,
      enum: Object.values(QUOTATION_STATUS),
      default: QUOTATION_STATUS.DRAFT,
    },
    generatedFile: fileRefSchema,
    adminSignedFile: fileRefSchema,
    finalSignedFile: fileRefSchema,
    // Only the SHA-256 hash is ever stored — same pattern as UploadRequest.
    shareTokenHash: { type: String, select: false },
    shareTokenExpiresAt: Date,
    sharedAt: Date,
    signedAt: Date,
  },
  { timestamps: true }
);

quotationSchema.index({ client: 1, version: -1 });

quotationSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.shareTokenHash;
    return ret;
  },
});

module.exports = model('Quotation', quotationSchema);
