const { Schema, model } = require('mongoose');
const { UPLOAD_REQUEST_STATUS } = require('../config/constants');

const uploadRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    // Stored (and returned) in plain text on purpose — the upload link needs
    // to be reconstructable later (shown in the employee's request history
    // until it expires), not just available once at creation time.
    token: { type: String, required: true, unique: true, index: true },
    // A short one-time-entry code the employee must type on the upload page
    // in addition to having the link — a second, separately-delivered
    // secret, distinct from (and unrelated to) the platform credentials
    // stored via "Add Credentials". Cleared once the request stops being
    // active (expired/revoked/fulfilled) so it can't be reused or leaked
    // from the database after the fact.
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

module.exports = model('UploadRequest', uploadRequestSchema);
