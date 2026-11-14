const { Schema, model } = require('mongoose');

// A generated document sent to an employee — to sign online ('sign'), or,
// with nothing for them to sign (experience / relieving letters), issued as
// a verifiable copy ('issue'). services/esign.service.js.
//
// The document exactly as sent is kept with its SHA-256 fingerprint; once
// signed (or issued), the final PDF and its fingerprint are kept too. That
// record never changes afterwards and is never deleted — the public
// verification page checks copies against it.
const FINAL = ['signed', 'issued'];
const LOCKED = ['html', 'sentPdf', 'originalHash', 'signedPdf', 'signedHash', 'signedAt', 'signerName', 'signatureImage', 'signerIp', 'signerAgent', 'issuedAt', 'code'];

const eventSchema = new Schema(
  {
    type: { type: String, required: true }, // sent, reminded, viewed, code_sent, code_failed, code_verified, signed, declined, cancelled, issued
    at: { type: Date, default: Date.now },
    ip: String,
    agent: String,
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    note: String,
  },
  { _id: false }
);

const documentSignatureSchema = new Schema(
  {
    document: { type: Schema.Types.ObjectId, ref: 'GeneratedDocument', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    templateKey: String,
    title: String,
    kind: { type: String, enum: ['sign', 'issue'], required: true },
    status: { type: String, enum: ['sent', 'viewed', 'signed', 'declined', 'cancelled', 'issued'], default: 'sent', index: true },
    // The public verification code (in the QR on the certificate page).
    code: { type: String, required: true, unique: true },

    channel: { type: String, enum: ['company', 'personal'], required: true },
    email: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // The link in the email (only its hash is kept); a short-lived one for
    // opening it from EMS; the one-time email code; the signing session.
    tokenHash: { type: String, index: true },
    tokenExpiresAt: Date,
    appTokenHash: { type: String, index: true },
    appTokenExpiresAt: Date,
    otp: { hash: String, expiresAt: Date, attempts: { type: Number, default: 0 }, sentAt: Date },
    sessionHash: String,
    sessionExpiresAt: Date,
    codeVerifiedAt: Date,
    viewedAt: Date,

    // The document as sent.
    html: { type: String, select: false },
    sentPdf: { type: Buffer, select: false },
    originalHash: String,
    companySignatories: [{ _id: false, key: String, name: String, title: String }],

    // Signed (or issued): the final PDF and how it was signed.
    signedAt: Date,
    issuedAt: Date,
    signerName: String,
    signatureImage: { type: Buffer, select: false },
    signerIp: String,
    signerAgent: String,
    consentText: String,
    signedPdf: { type: Buffer, select: false },
    signedHash: { type: String, index: true },

    declinedAt: Date,
    declineReason: String,
    cancelledAt: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelReason: String,

    events: [eventSchema],
  },
  { timestamps: true }
);

documentSignatureSchema.index({ originalHash: 1 });

// Once signed or issued, what was signed can't change.
documentSignatureSchema.post('init', function rememberFinal(doc) {
  doc.$locals.wasFinal = FINAL.includes(doc.status);
});
documentSignatureSchema.pre('save', function keepSignedRecord() {
  if (!this.isNew && this.$locals.wasFinal) {
    if (!FINAL.includes(this.status)) throw new Error('A signed document stays signed');
    const changed = LOCKED.filter((f) => this.isModified(f));
    if (changed.length) throw new Error(`A signed document's record can't change (${changed.join(', ')})`);
  }
});
function refuseBulk() {
  throw new Error('Signature records are changed one at a time, through the e-sign service');
}
documentSignatureSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'], refuseBulk);
function refuseDelete() {
  throw new Error('Signature records are kept for verification — they are never deleted');
}
documentSignatureSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], refuseDelete);

module.exports = model('DocumentSignature', documentSignatureSchema);
