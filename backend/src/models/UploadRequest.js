const { Schema, model } = require('mongoose');
const { UPLOAD_REQUEST_STATUS } = require('../config/constants');

const uploadRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    // Stored (and returned) in plain text on purpose — the upload link needs
    // to be reconstructable later (shown in the employee's request history
    // until it expires), not just available once at creation time.
    token: { type: String, required: true, unique: true, index: true },
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

module.exports = model('UploadRequest', uploadRequestSchema);
