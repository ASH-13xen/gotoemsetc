const { Schema, model } = require('mongoose');
const { INVOICE_STATUS } = require('../config/constants');

const transactionDetailsSchema = new Schema(
  { mode: String, referenceNumber: String, paidOn: Date, note: String },
  { _id: false }
);

const invoiceSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'TaskClient', required: true, index: true },
    // Billing period — the month this invoice covers (billed in arrears; see
    // jobs/invoiceGeneration.job.js).
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    plan: { type: String, required: true }, // snapshot of TaskClient.currentPlan at generation time
    amount: { type: Number, required: true }, // snapshot of PlanPrice at generation time
    // "INV/2026-27/0001" — sequential per Indian financial year (Apr-Mar).
    invoiceNumber: { type: String, required: true, unique: true },
    status: { type: String, enum: Object.values(INVOICE_STATUS), default: INVOICE_STATUS.PENDING_APPROVAL },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    sentAt: Date,
    paidAt: Date,
    paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
    transactionDetails: transactionDetailsSchema,
  },
  { timestamps: true }
);

invoiceSchema.index({ client: 1, year: 1, month: 1 }, { unique: true });

module.exports = model('Invoice', invoiceSchema);
