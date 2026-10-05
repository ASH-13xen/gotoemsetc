const { Schema, model } = require('mongoose');
const { OVERTIME_REQUEST_STATUS, OVERTIME_REQUEST_STAGE } = require('../config/constants');

// One per employee per day. Overtime no longer counts by itself: a day's
// biometric overtime above the review threshold, or any overtime an
// employee applies for, waits here — content manager first (when the
// employee's team has one), then HR — and only HR's approval writes the
// minutes onto the attendance record. See overtimeRequest.service.js.
const overtimeRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: Date, required: true }, // normalized to midnight, day-only

    // What the scans worked out for the day (kept in step while pending) and
    // what the employee asked for, if they applied. Either can be absent.
    biometricMinutes: { type: Number, default: 0, min: 0 },
    appliedMinutes: { type: Number, default: null, min: 0 },
    employeeReason: { type: String, trim: true },

    stage: { type: String, enum: Object.values(OVERTIME_REQUEST_STAGE), required: true },
    status: {
      type: String,
      enum: Object.values(OVERTIME_REQUEST_STATUS),
      default: OVERTIME_REQUEST_STATUS.PENDING,
    },

    // Content manager's step — the minutes they vouch for and why (required).
    cmMinutes: { type: Number, default: null, min: 0 },
    cmReason: { type: String, trim: true },
    cmApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cmApprovedAt: { type: Date },

    // HR's final decision — approvedMinutes is what lands on attendance.
    approvedMinutes: { type: Number, default: null, min: 0 },
    hrNote: { type: String, trim: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAs: { type: String },
    decidedAt: { type: Date },

    // Which step turned it down, and why.
    rejectedStage: { type: String, enum: [...Object.values(OVERTIME_REQUEST_STAGE), null], default: null },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

overtimeRequestSchema.index({ employee: 1, date: 1 }, { unique: true });
overtimeRequestSchema.index({ status: 1, stage: 1 });

module.exports = model('OvertimeRequest', overtimeRequestSchema);
