const { Schema, model } = require('mongoose');
const { UPLOAD_REQUEST_STATUS } = require('../config/constants');

const uploadRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    // Never returned by default — it's only ever needed internally to look up
    // a request by its incoming token, not for display in any API response.
    tokenHash: { type: String, required: true, unique: true, index: true, select: false },
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

// `select: false` above only hides tokenHash from query results — a document
// just returned from .create()/.save() still has it in memory. Stripping it
// in toJSON guarantees it never leaks into an API response either way.
uploadRequestSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.tokenHash;
    return ret;
  },
});

module.exports = model('UploadRequest', uploadRequestSchema);
