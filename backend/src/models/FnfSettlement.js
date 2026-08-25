const { Schema, model } = require('mongoose');
const { PAYMENT_STATUS } = require('../config/constants');

// One per GeneratedDocument produced from the 'fnf-settlement' template (see
// docGeneration.service.js's hook) — deliberately a separate, Finance-owned
// model rather than payment fields bolted onto GeneratedDocument itself,
// since GeneratedDocument is a generic store shared by every document type
// (offer letters, relieving letters, etc.) where "paid" has no meaning.
const transactionDetailsSchema = new Schema(
  { mode: String, referenceNumber: String, paidOn: Date, note: String },
  { _id: false }
);

const fnfSettlementSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    generatedDocument: { type: Schema.Types.ObjectId, ref: 'GeneratedDocument', required: true, unique: true },
    // Copied from the raw (pre-currency-formatting) severanceAmount override
    // at generation time — see docGeneration.service.js.
    amount: Number,
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.DUE },
    paidAt: Date,
    paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
    transactionDetails: transactionDetailsSchema,
  },
  { timestamps: true }
);

module.exports = model('FnfSettlement', fnfSettlementSchema);
