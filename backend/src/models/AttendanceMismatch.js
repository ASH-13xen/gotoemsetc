const { Schema, model } = require('mongoose');

// A day set by an approved request whose scans told a different story — see
// attendanceClassifier.service.js#checkRequestDay. One per person per day,
// listed in the Action centre for HR and the CEO.
const attendanceMismatchSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    request: { type: Schema.Types.ObjectId, ref: 'AttendanceModificationRequest' },
    // In words: what they applied for, and what the scans showed.
    applied: { type: String, required: true },
    scans: { type: String, required: true },
    // 'changed': the day now follows the scans. 'unclear': one scan or a
    // pattern no rule fits — the approved status was kept, for HR to check.
    outcome: { type: String, enum: ['changed', 'unclear'], required: true },
    before: { status: String, earlyDeparture: Boolean },
    after: { status: String, earlyDeparture: Boolean },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

attendanceMismatchSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceMismatchSchema.index({ createdAt: -1 });

module.exports = model('AttendanceMismatch', attendanceMismatchSchema);
