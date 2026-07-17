const { Schema, model } = require('mongoose');
const { ATTENDANCE_STATUS } = require('../config/constants');

const attendanceRecordSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: Date, required: true, index: true }, // normalized to midnight, day-only
    // Optional — a record can exist purely to log overtime hours on an
    // otherwise-unmarked day (e.g. a Sunday worked only for a few OT hours).
    status: { type: String, enum: Object.values(ATTENDANCE_STATUS) },
    // Independent of status — loggable on any date, including Sundays/holidays.
    overtimeHours: { type: Number, default: 0, min: 0 },
    // True when this record was written on a day after `date` already passed —
    // a data-entry/audit flag, not a statement about the employee's punctuality.
    isBackdated: { type: Boolean, default: false },
    // True only when the daily biometric classifier wrote this record. Any
    // manual admin save (markAttendance) always sets this back to false —
    // that's what makes an admin edit permanent: the classifier skips any
    // day that isn't currently isAutoMarked, so it never overwrites a human
    // decision, but freely re-classifies its own earlier auto-marks.
    isAutoMarked: { type: Boolean, default: false },
    // Independent of status — arrival past the grace cutoff, whether or not
    // it also pushed the day into Short Leave/Half Day. Feeds the payroll
    // late->short-leave conversion (see salaryCalculation.service.js)
    // alongside (not instead of) a literal status: 'L' day.
    isLate: { type: Boolean, default: false },
    // True only when this record was last updated via the attendance
    // modification request resolve endpoint — the "modified by HR" marker.
    modifiedByRequest: { type: Boolean, default: false },
    // Departure-side Short Leave (left 4:30pm-shiftEnd) — independent of
    // status, can co-occur with an arrival-side status: 'SL'/'H' day (two
    // short leaves in one day). See attendanceClassifier.service.js.
    earlyDeparture: { type: Boolean, default: false },
    // False while the day could still be revised by a later scan today (the
    // real-time classifier keeps updating status/earlyDeparture/overtimeHours
    // as scans arrive); true once finalized — either by tomorrow's first
    // scan proving today is over, or by the nightly backstop. Notifications
    // only fire once settled, so a mid-day guess never spams an admin.
    isSettled: { type: Boolean, default: false },
    notes: String,
  },
  { timestamps: true }
);

attendanceRecordSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = model('AttendanceRecord', attendanceRecordSchema);
