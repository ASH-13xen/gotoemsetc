const { Schema, model } = require('mongoose');
const { ACCOUNT_KINDS } = require('../utils/deviceCatalog');

// A company account that lives on devices — each phone's own Apple ID or
// Gmail, the WhatsApp Business number, the Instagram page… — with where its
// 2-step codes go and which devices it is signed in on. The password and PIN
// are encrypted (utils/secretCrypto.js) and only ever revealed, one at a
// time and logged, to admin, the CEO and HR.
const deviceAccountSchema = new Schema(
  {
    kind: { type: String, enum: Object.keys(ACCOUNT_KINDS), required: true },
    label: { type: String, trim: true }, // e.g. "GoTo phone 3 Apple ID"
    identifier: { type: String, required: true, trim: true }, // email, number or handle
    password: { type: String, select: false }, // encrypted
    pin: { type: String, select: false }, // encrypted (e.g. WhatsApp two-step PIN)
    recoveryEmail: { type: String, trim: true },
    recoveryPhone: { type: String, trim: true },
    twoFactorOn: { type: Boolean, default: false },
    // Where the 2-step codes go — should be a company number, never a person's.
    codesGoTo: { type: String, trim: true },
    devices: [{ type: Schema.Types.ObjectId, ref: 'Device' }],
    // Someone's own work account (e.g. their company mail), else the company's.
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    notes: { type: String, trim: true },
    passwordChangedAt: Date,
    passwordChangedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

deviceAccountSchema.index({ kind: 1, identifier: 1 });

module.exports = model('DeviceAccount', deviceAccountSchema);
