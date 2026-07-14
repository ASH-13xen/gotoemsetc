const { Schema, model } = require('mongoose');
const { UPLOAD_REQUEST_STATUS } = require('../config/constants');

// Mirrors UploadRequest (EMS employee document requests) exactly, including
// the access-code login step, but for Client and with freeform requested
// items instead of a fixed docType enum — the admin types whatever they
// need (e.g. "Signed NDA", "GST Certificate") rather than picking from a
// preset list. Order matters: a requested item's array index is its
// "slot", used to match uploaded files back to what was asked for (see
// clientDocumentRequest.service.js).
const clientDocumentRequestSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    accessCode: { type: String, default: null },
    requestedDocTypes: [{ type: String, required: true }],
    status: {
      type: String,
      enum: Object.values(UPLOAD_REQUEST_STATUS),
      default: UPLOAD_REQUEST_STATUS.PENDING,
    },
    expiresAt: { type: Date, required: true, index: true },
    fulfilledAt: Date,
  },
  { timestamps: true }
);

module.exports = model('ClientDocumentRequest', clientDocumentRequestSchema);
