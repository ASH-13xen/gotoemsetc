const { Schema, model } = require('mongoose');
const { MONTHLY_BILL_INSTANCE_STATUS } = require('../config/constants');

// paid vs paid_late is resolved at the moment of marking paid (now vs. the
// instance's own dueDate) — same computed-flag pattern
// EMPLOYEE_TASK_COMPLETION_FLAG's on_time/late already uses.
const transactionDetailsSchema = new Schema(
  { mode: String, referenceNumber: String, paidOn: Date, note: String },
  { _id: false }
);

// One per calendar month this bill has been due — bounded, small (12/year),
// same embedding choice as TaskClient.teamHistory rather than a separate
// collection.
const billInstanceSchema = new Schema({
  year: { type: Number, required: true },
  month: { type: Number, required: true }, // 1-12
  dueDate: { type: Date, required: true },
  status: {
    type: String,
    enum: Object.values(MONTHLY_BILL_INSTANCE_STATUS),
    default: MONTHLY_BILL_INSTANCE_STATUS.DUE,
  },
  paidAt: Date,
  paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
  transactionDetails: transactionDetailsSchema,
});

const monthlyBillSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    // Day of month this bill is due — clamped to the actual last day of a
    // shorter month when an instance is spawned (see jobs/monthlyBillCycle.job.js).
    dueDay: { type: Number, required: true, min: 1, max: 31 },
    // Set false to stop spawning future instances without deleting history.
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    instances: [billInstanceSchema],
  },
  { timestamps: true }
);

module.exports = model('MonthlyBill', monthlyBillSchema);
