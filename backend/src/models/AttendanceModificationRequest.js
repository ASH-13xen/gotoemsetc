const { Schema, model } = require('mongoose');
const { ATTENDANCE_REQUEST_STATUS } = require('../config/constants');

// A worker's ask to correct a specific day's attendance — resolving one
// (admin-only, see attendanceRequest.service.js#resolve) optionally applies
// the actual AttendanceRecord change in the same step and tags that record
// modifiedByRequest: true.
const attendanceModificationRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: Date, required: true }, // normalized to midnight, day-only — the day being disputed
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_REQUEST_STATUS),
      default: ATTENDANCE_REQUEST_STATUS.PENDING,
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = model('AttendanceModificationRequest', attendanceModificationRequestSchema);
