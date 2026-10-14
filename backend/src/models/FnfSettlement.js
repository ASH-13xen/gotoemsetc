const { Schema, model } = require('mongoose');
const { PAYMENT_STATUS, FNF_STAGE } = require('../config/constants');

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
    // The severance on the settlement document.
    amount: Number,
    // The document's separation date — what HR is offered as the last day
    // when the employee's record has none.
    separationDate: Date,

    // Where it stands — see fnfSettlement.service.js. Unset on settlements
    // from before this flow (they go straight to Finance).
    stage: { type: String, enum: [...Object.values(FNF_STAGE), null], default: null, index: true },
    lastWorkingDay: Date,
    // The final salary slip, up to the last working day.
    salarySlip: { type: Schema.Types.ObjectId, ref: 'SalarySlip' },
    hrConfirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    hrConfirmedAs: String,
    hrConfirmedAt: Date,
    ceoDecidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    ceoDecidedAs: String,
    ceoDecidedAt: Date,
    // Why the CEO/admin sent it back to HR.
    sendBackNote: { type: String, trim: true },
    financeEmail: { to: String, status: String, error: String },

    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.DUE },
    paidAt: Date,
    paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
    transactionDetails: transactionDetailsSchema,
    // Finance's receipt — required to mark it paid, and mailed to the employee.
    paymentReceiptFile: {
      data: { type: Buffer, select: false },
      contentType: String,
      filename: String,
    },
  },
  { timestamps: true }
);

module.exports = model('FnfSettlement', fnfSettlementSchema);
