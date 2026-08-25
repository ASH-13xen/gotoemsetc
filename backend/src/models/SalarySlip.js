const { Schema, model } = require('mongoose');
const { PAYMENT_STATUS } = require('../config/constants');

// Stored on local disk, same as quotations — Cloudinary's account-level
// security policy blocks unauthenticated PDF delivery entirely.
const fileRefSchema = new Schema({ filePath: { type: String, required: true } }, { _id: false });

// Set once Finance actually pays the slip — see salarySlip.service.js#markSalaryPaid.
// Kept on the slip itself rather than a parallel Finance-owned model since a
// salary slip is already inherently a Finance record, unlike e.g. FnF's
// GeneratedDocument (a generic, multi-purpose document store).
const transactionDetailsSchema = new Schema(
  { mode: String, referenceNumber: String, paidOn: Date, note: String },
  { _id: false }
);

const salarySlipSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    // The pay period is a free-form date range rather than a calendar
    // month — attendance is stored per-day, so any admin-picked range can
    // be summarized without being anchored to month boundaries.
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Manual inputs, taken at generation time.
    incomeTaxDeduction: { type: Number, default: 0 },
    professionTax: { type: Number, default: 0 },
    pf: { type: Number, default: 0 },
    otherDeduction3: { type: Number, default: 0 },
    compensationOff: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    travelAllowance: { type: Number, default: 0 },
    otherEarning1: { type: Number, default: 0 },
    reimbursement1: { type: Number, default: 0 },
    reimbursement2: { type: Number, default: 0 },

    // Computed results, kept for record-keeping/audit rather than recomputed
    // on every re-download.
    basicMaster: Number,
    basicEarnings: Number,
    otMaster: Number,
    otEarnings: Number,
    halfDayDeductions: Number,
    unpaidOffDeductions: Number,
    grossEarnings: Number,
    totalDeductions: Number,
    totalReimbursements: Number,
    netPayable: Number,
    netPayableWords: String,

    generatedFile: { type: fileRefSchema, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // Finance section — see services/salarySlip.service.js#markSalaryPaid.
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.DUE },
    paidAt: Date,
    paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
    transactionDetails: transactionDetailsSchema,
  },
  { timestamps: true }
);

salarySlipSchema.index({ employee: 1, startDate: -1 });

module.exports = model('SalarySlip', salarySlipSchema);
