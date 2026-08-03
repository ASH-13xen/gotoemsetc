const { Schema, model } = require('mongoose');
const { ATTENDANCE_WARNING_CATEGORY } = require('../config/constants');

// Permanent log of "not informed" warnings issued from the daily attendance
// report — never edited or deleted, even after the month it belongs to has
// ended. Monthly counts shown to HR/admin (Employee Detail page) and to the
// employee themself (login modal) are derived on read via countDocuments
// against this collection rather than a separately maintained counter, so
// they can never drift from this history.
const attendanceWarningSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: Date, required: true }, // the AttendanceRecord.date this warning is about
    category: { type: String, enum: Object.values(ATTENDANCE_WARNING_CATEGORY), required: true },
    message: { type: String, required: true, trim: true },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// One warning per employee/date/category — the real idempotency guard
// (enforced at the DB level, not just an app-side pre-check), so a double
// click or a race between two HR sessions can't double-count the same
// occurrence. See attendanceWarning.service.js#sendWarning.
attendanceWarningSchema.index({ employee: 1, date: 1, category: 1 }, { unique: true });

module.exports = model('AttendanceWarning', attendanceWarningSchema);
