const { Schema, model } = require('mongoose');
const { ATTENDANCE_STATUS, ATTENDANCE_EDIT_REQUEST_STATUS } = require('../config/constants');

// HR can't change attendance more than 2 days old directly (see
// attendance.service.js#assertCanEditAttendanceDate). Instead they file one
// of these; only the CEO and admin see it, and whichever approves first
// applies the change. See attendanceEditRequest.service.js.
const attendanceEditRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: Date, required: true }, // UTC midnight, day-only
    // The change HR wants — same fields as a direct mark.
    change: {
      status: { type: String, enum: Object.values(ATTENDANCE_STATUS) },
      overtimeMinutes: { type: Number, min: 0 },
      isLate: { type: Boolean },
      earlyDeparture: { type: Boolean },
      paidLeaveAwarded: { type: Boolean },
    },
    reason: { type: String, required: true, trim: true },
    // The day as it was when HR asked, so the approver can compare.
    previous: { type: Schema.Types.Mixed, default: null },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_EDIT_REQUEST_STATUS),
      default: ATTENDANCE_EDIT_REQUEST_STATUS.PENDING,
      index: true,
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    decisionNote: { type: String, trim: true },
  },
  { timestamps: true }
);

attendanceEditRequestSchema.index({ employee: 1, date: 1, status: 1 });

module.exports = model('AttendanceEditRequest', attendanceEditRequestSchema);
