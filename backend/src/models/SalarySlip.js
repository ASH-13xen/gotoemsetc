const { Schema, model } = require('mongoose');

// Stored on local disk, same as quotations — Cloudinary's account-level
// security policy blocks unauthenticated PDF delivery entirely.
const fileRefSchema = new Schema({ filePath: { type: String, required: true } }, { _id: false });

const salarySlipSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    // The manually-selected "as of" date payroll was run against — 1st of
    // the month through this date is what "Total number of Days" covers.
    cutoffDate: { type: Date, required: true },

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

    generatedFile: { type: fileRefSchema, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

salarySlipSchema.index({ employee: 1, year: -1, month: -1 });

module.exports = model('SalarySlip', salarySlipSchema);
