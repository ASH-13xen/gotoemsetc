const { Schema, model } = require('mongoose');
const {
  ATTENDANCE_REQUEST_STATUS,
  ATTENDANCE_STATUS,
  ATTENDANCE_REQUEST_APPROVAL_STAGE,
  ATTENDANCE_REQUEST_HALF_DAY_PERIOD,
} = require('../config/constants');

// A worker's ask to correct a specific day's attendance — resolving one
// (admin-only, see attendanceRequest.service.js#resolve) optionally applies
// the actual AttendanceRecord change in the same step and tags that record
// modifiedByRequest: true.
//
// Also doubles as the structured "apply for leave" flow (frontendall) via
// the optional requestedStatus field below — same request/resolve/list
// infrastructure, two producers. The free-text flow (frontendems) never
// sets requestedStatus and is otherwise completely unchanged by any of this.
const attendanceModificationRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: Date, required: true }, // normalized to midnight, day-only — the first (or only) day being disputed
    // Inclusive end of the span, only ever different from `date` for the
    // structured "apply for leave" flow (frontendall) — a multi-day leave
    // application. Free-text requests (frontendems) always leave this equal
    // to `date`. See attendanceRequest.service.js#resolveRequest for how a
    // range gets applied to every day at once.
    endDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    // Set only by the structured "apply for leave" flow — the employee's own
    // pick, restricted to LEAVE_APPLICATION_STATUSES at the validator level.
    // The approver's own status choice at resolve time is independent and
    // still wins; this is shown to them only as the employee's suggestion.
    requestedStatus: { type: String, enum: Object.values(ATTENDANCE_STATUS) },
    // Set only when requestedStatus is 'H' — which half of the day the
    // employee is applying to be out for. See constants.js for why this has
    // no effect on the eventual AttendanceRecord, only on what the approver
    // sees.
    requestedHalfDayPeriod: { type: String, enum: Object.values(ATTENDANCE_REQUEST_HALF_DAY_PERIOD) },
    // Independent of requestedStatus, same as earlyDeparture is independent
    // of status on AttendanceRecord itself — an employee can apply for
    // "Early Departure" on its own, with no other requestedStatus set.
    requestedEarlyDeparture: { type: Boolean, default: false },
    // The "Multiple Days" type in the Apply-for-leave dialog — a general,
    // uncapped multi-day leave request that deliberately carries no
    // requestedStatus (unlike Work From Home, which is 'W'): the employee
    // isn't claiming a specific status for the span, just asking to be off:
    // whoever resolves it picks the actual per-day status, same as always.
    // Independent of requestedStatus/requestedEarlyDeparture, same pattern
    // as both. See resolveApprovalStage/isLeaveApplication in
    // attendanceRequest.service.js for why this also needs to count as a
    // leave application (future dates allowed, CM/HR two-stage routing).
    requestedMultiDayLeave: { type: Boolean, default: false },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_REQUEST_STATUS),
      default: ATTENDANCE_REQUEST_STATUS.PENDING,
    },
    // Which tier must act next, while status is still 'pending' — see
    // attendanceRequest.service.js#resolveApprovalStage. Defaults to 'hr' so
    // every pre-existing document, and every free-text request (which never
    // goes through resolveApprovalStage), behaves exactly as before this
    // field existed — no migration needed.
    approvalStage: {
      type: String,
      enum: Object.values(ATTENDANCE_REQUEST_APPROVAL_STAGE),
      default: ATTENDANCE_REQUEST_APPROVAL_STAGE.HR,
    },
    // Set only when a Content Manager advanced this request to the HR
    // stage — see attendanceRequest.service.js#approveAtContentManagerStage.
    cmApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cmApprovedAt: { type: Date },
    // Unpaid Leave only — set when HR approves and forwards to the CEO stage.
    // pendingAttendanceUpdate is HR's chosen per-day change, held here
    // untouched until the CEO approves (which applies it) or rejects.
    hrApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    hrApprovedAt: { type: Date },
    // The role each approver acted in ('hr', 'ceo'…) — "Approved by Juhika
    // (HR)" is shown only to her and the people above that role.
    hrApprovedAs: { type: String },
    pendingAttendanceUpdate: { type: Schema.Types.Mixed, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    resolvedAs: { type: String },
    // True only when resolving this request actually applied an
    // AttendanceRecord change — a request resolved with no override has
    // nothing to revoke, and previousRecordSnapshot below is never captured
    // for it.
    attendanceWasModified: { type: Boolean, default: false },
    // The date's AttendanceRecord fields exactly as they were immediately
    // before resolution overwrote them — null means no record existed yet
    // at that point. Captured only when attendanceWasModified is true. This
    // is what makes revoke non-destructive: it restores this snapshot (or,
    // if null, explicitly unmarks the record via attendance.repository.js's
    // applySnapshot) rather than ever deleting anything.
    previousRecordSnapshot: { type: Schema.Types.Mixed, default: null },
    rejectionReason: { type: String, trim: true },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    revokedAs: { type: String },
    revokedAt: { type: Date },
    // Flips true once the employee has acknowledged this request's outcome
    // on their dashboard (see AttendanceOutcomeModal in frontendall) — only
    // ever consulted for requests carrying a requestedStatus; free-text
    // requests are never surfaced there regardless of this flag.
    seenByEmployee: { type: Boolean, default: false },
    // The employee ticking a decided request off their dashboard card — it
    // stays in their full list. Separate from seenByEmployee above, which
    // only says the outcome pop-up was closed. Cleared if the request is
    // later revoked, so that outcome shows up again.
    dashboardAcknowledgedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = model('AttendanceModificationRequest', attendanceModificationRequestSchema);
