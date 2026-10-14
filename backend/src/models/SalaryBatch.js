const { Schema, model } = require('mongoose');
const { SALARY_BATCH_STATUS, SALARY_BATCH_KIND } = require('../config/constants');

// Salary slips don't go out by themselves. Every run of the bulk generator
// (and every single slip generated from an employee's page) lands in a
// batch that waits for the CEO or admin. Approving it mails each employee
// their own slip, mails the master sheet to Finance, and only then do the
// slips appear in the Finance tab and to the employees. See
// salaryBatch.service.js.
const emailResultSchema = new Schema(
  {
    slip: { type: Schema.Types.ObjectId, ref: 'SalarySlip' },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee' },
    employeeName: String,
    to: String,
    // sent | failed | no_address
    status: { type: String, required: true },
    error: String,
  },
  { _id: false }
);

const salaryBatchSchema = new Schema(
  {
    kind: { type: String, enum: Object.values(SALARY_BATCH_KIND), required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    slips: [{ type: Schema.Types.ObjectId, ref: 'SalarySlip' }],
    status: { type: String, enum: Object.values(SALARY_BATCH_STATUS), default: SALARY_BATCH_STATUS.PENDING, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAs: String,

    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAs: String,
    decidedAt: Date,
    // Why it was sent back to HR.
    note: { type: String, trim: true },

    // What happened to each mail when it was approved.
    emailResults: [emailResultSchema],
    masterSheetEmail: { to: String, status: String, error: String },
  },
  { timestamps: true }
);

module.exports = model('SalaryBatch', salaryBatchSchema);
