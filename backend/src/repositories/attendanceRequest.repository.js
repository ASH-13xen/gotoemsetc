const AttendanceModificationRequest = require('../models/AttendanceModificationRequest');
const { ATTENDANCE_REQUEST_STATUS, ATTENDANCE_REQUEST_APPROVAL_STAGE } = require('../config/constants');

function create(data) {
  return AttendanceModificationRequest.create(data);
}

// Admins see everything; a worker only ever calls this with their own
// employeeId (enforced by requireSelfOrAdmin at the route level).
// `approvalStage` and `employeeIds` back the Content Manager's "pending my
// review" queue (attendanceRequest.service.js#listPendingForContentManager)
// — a bulk query across every employee on their team(s) at once.
function list({ employeeId, status, approvalStage, employeeIds } = {}) {
  const query = {};
  if (employeeId) query.employee = employeeId;
  if (employeeIds) query.employee = { $in: employeeIds };
  if (status) query.status = status;
  if (approvalStage) query.approvalStage = approvalStage;
  return AttendanceModificationRequest.find(query).sort({ createdAt: -1 }).populate('employee', 'firstName lastName');
}

function findById(id) {
  return AttendanceModificationRequest.findById(id);
}

// Advances a request from the Content Manager stage to the HR stage —
// status stays 'pending' throughout; only approvalStage moves. See
// attendanceRequest.service.js#approveAtContentManagerStage.
function advanceToHrStage(id, cmApprovedBy) {
  return AttendanceModificationRequest.findByIdAndUpdate(
    id,
    { approvalStage: ATTENDANCE_REQUEST_APPROVAL_STAGE.HR, cmApprovedBy, cmApprovedAt: new Date() },
    { new: true }
  );
}

function resolve(id, resolvedBy, { attendanceWasModified = false, previousRecordSnapshot = null } = {}) {
  return AttendanceModificationRequest.findByIdAndUpdate(
    id,
    {
      status: ATTENDANCE_REQUEST_STATUS.RESOLVED,
      resolvedBy,
      resolvedAt: new Date(),
      attendanceWasModified,
      previousRecordSnapshot,
    },
    { new: true }
  );
}

function reject(id, resolvedBy, rejectionReason) {
  return AttendanceModificationRequest.findByIdAndUpdate(
    id,
    { status: ATTENDANCE_REQUEST_STATUS.REJECTED, resolvedBy, resolvedAt: new Date(), rejectionReason },
    { new: true }
  );
}

// Never deletes the request document — a revoked request stays in the list
// forever, same lifecycle as a resolved/rejected one, just with a status
// that says "approved, then undone" rather than pretending it never
// happened.
function revoke(id, revokedBy) {
  return AttendanceModificationRequest.findByIdAndUpdate(
    id,
    { status: ATTENDANCE_REQUEST_STATUS.REVOKED, revokedBy, revokedAt: new Date() },
    { new: true }
  );
}

function markSeen(id) {
  return AttendanceModificationRequest.findByIdAndUpdate(id, { seenByEmployee: true }, { new: true });
}

// Powers the dashboard result modal — only structured "apply for leave"
// requests (requestedStatus present) that reached a terminal outcome the
// employee hasn't acknowledged yet. Free-text requests never carry
// requestedStatus, so they never surface here regardless of seenByEmployee.
function listUnseenForEmployee(employeeId) {
  return AttendanceModificationRequest.find({
    employee: employeeId,
    $or: [{ requestedStatus: { $exists: true, $ne: null } }, { requestedEarlyDeparture: true }],
    status: {
      $in: [ATTENDANCE_REQUEST_STATUS.RESOLVED, ATTENDANCE_REQUEST_STATUS.REJECTED, ATTENDANCE_REQUEST_STATUS.REVOKED],
    },
    seenByEmployee: { $ne: true },
  }).sort({ updatedAt: -1 });
}

module.exports = { create, list, findById, advanceToHrStage, resolve, reject, revoke, markSeen, listUnseenForEmployee };
