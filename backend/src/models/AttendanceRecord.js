const { Schema, model } = require('mongoose');
const { ATTENDANCE_STATUS } = require('../config/constants');

const attendanceRecordSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: Date, required: true, index: true }, // normalized to midnight, day-only
    status: { type: String, enum: Object.values(ATTENDANCE_STATUS), required: true },
    // True when this record was written on a day after `date` already passed —
    // a data-entry/audit flag, not a statement about the employee's punctuality.
    isBackdated: { type: Boolean, default: false },
    notes: String,
  },
  { timestamps: true }
);

attendanceRecordSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = model('AttendanceRecord', attendanceRecordSchema);
