const { Schema, model } = require('mongoose');

// The company's authorised signatories for documents (services/esign.service.js):
// whose signature is placed on a document when it's generated — the CEO on
// most letters, HR on the appointment / relieving / off-boarding letters, as
// each template names. One record ('settings').
const signatorySchema = new Schema(
  {
    key: { type: String, enum: ['ceo', 'hr'], required: true },
    name: { type: String, trim: true, required: true },
    title: { type: String, trim: true },
    image: { data: Buffer, contentType: String },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedAt: Date,
  },
  { _id: false }
);

const eSignSettingsSchema = new Schema(
  {
    key: { type: String, default: 'settings', unique: true },
    signatories: [signatorySchema],
  },
  { timestamps: true }
);

module.exports = model('ESignSettings', eSignSettingsSchema);
