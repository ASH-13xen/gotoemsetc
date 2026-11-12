const { Schema, model } = require('mongoose');

// A file belonging to HR Work → Devices — check photos, signed handover
// agreements and return receipts, police complaints, the brand kit's logo and
// brochure. Kept in the database (the server's disk does not survive a
// deploy); the bytes are only loaded when the file itself is asked for.
const deviceFileSchema = new Schema(
  {
    kind: { type: String, enum: ['photo', 'agreement', 'receipt', 'police', 'brand', 'other'], required: true },
    data: { type: Buffer, select: false, required: true },
    contentType: { type: String, required: true },
    filename: { type: String, trim: true },
    size: Number,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = model('DeviceFile', deviceFileSchema);
