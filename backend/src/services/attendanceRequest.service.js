const ApiError = require('../utils/ApiError');
const attendanceRequestRepository = require('../repositories/attendanceRequest.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const employeeRepository = require('../repositories/employee.repository');
const userRepository = require('../repositories/user.repository');
const workTeamRepository = require('../repositories/workTeam.repository');
const notificationService = require('./notification.service');
const notifyRecipients = require('./notifyRecipients.service');
const attendanceService = require('./attendance.service');
const teamRoles = require('../utils/teamRoles');
const {
  ATTENDANCE_REQUEST_STATUS,
  ATTENDANCE_REQUEST_APPROVAL_STAGE,
  ATTENDANCE_STATUS,
  TEAM_MEMBER_ROLE,
  NOTIFICATION_TYPES,
} = require('../config/constants');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REQUEST_SUBMISSION_CUTOFF_DAYS = 2;
// Sanity cap on how many days a single "apply for leave" span can cover —
// prevents an accidental huge range from writing a huge number of
// AttendanceRecords in one request.
const MAX_LEAVE_SPAN_DAYS = 31;

function todayUTCMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Every UTC-midnight day from `start` to `end`, inclusive.
function enumerateDates(start, end) {
  const dates = [];
  for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) {
    dates.push(new Date(t));
  }
  return dates;
}

// One paid leave (status O) per employee per calendar month — checked
// against both the month's actual AttendanceRecords (covers a paid leave
// applied directly by HR/admin, not just one that went through this request
// flow) and any pending/resolved leave-application request already targeting
// that month (so an employee can't queue up a second one before the first is
// decided). Only the month containing `date` is checked — a span that
// crosses a month boundary is not specially handled beyond that.
async function isEligibleForPaidLeave(employeeId, date) {
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

  const records = await attendanceRepository.listForEmployee(employeeId, { from, to });
  if (records.some((r) => r.status === ATTENDANCE_STATUS.PAID_LEAVE)) return false;

  const existingRequests = await attendanceRequestRepository.list({ employeeId });
  return !existingRequests.some((r) => {
    if (r.requestedStatus !== ATTENDANCE_STATUS.PAID_LEAVE) return false;
    if (![ATTENDANCE_REQUEST_STATUS.PENDING, ATTENDANCE_REQUEST_STATUS.RESOLVED].includes(r.status)) return false;
    return r.date.getTime() >= from.getTime() && r.date.getTime() <= to.getTime();
  });
}

async function checkPaidLeaveEligibility(employeeId, dateStr) {
  const date = dateStr ? new Date(dateStr) : todayUTCMidnight();
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('Invalid date');
  return isEligibleForPaidLeave(employeeId, date);
}

// Which tier must review a structured leave application first — the
// free-text flow (frontendems) never calls this at all, and always stays
// at the model's 'hr' default. Content Manager review is skipped straight
// to HR when: the employee belongs to no team; the employee is themself a
// Content Manager on one of their teams (self-review makes no sense); or
// none of their teams has anyone tagged Content Manager at all (so a
// request is never permanently unroutable). Per product decision, an
// employee on multiple teams can be approved by a Content Manager from
// ANY of them — the union of every team's tagged CMs.
async function resolveApprovalStage(employeeId, isLeaveApplication) {
  if (!isLeaveApplication) return { stage: ATTENDANCE_REQUEST_APPROVAL_STAGE.HR, cmIds: [] };

  const teams = await workTeamRepository.listForMember(employeeId);
  if (teams.length === 0) return { stage: ATTENDANCE_REQUEST_APPROVAL_STAGE.HR, cmIds: [] };

  const isCmThemself = teams.some((t) => teamRoles.hasRole(t, employeeId, TEAM_MEMBER_ROLE.CONTENT_MANAGER));
  if (isCmThemself) return { stage: ATTENDANCE_REQUEST_APPROVAL_STAGE.HR, cmIds: [] };

  const cmIds = [...new Set(teams.flatMap((t) => teamRoles.membersWithRole(t, TEAM_MEMBER_ROLE.CONTENT_MANAGER)))];
  if (cmIds.length === 0) return { stage: ATTENDANCE_REQUEST_APPROVAL_STAGE.HR, cmIds: [] };

  return { stage: ATTENDANCE_REQUEST_APPROVAL_STAGE.CONTENT_MANAGER, cmIds };
}

// Requests now go to HR (not admin) to review — HR is the day-to-day
// attendance handler; admin retains full unrestricted edit access separately
// and doesn't need to be paged for every request. A hard cutoff: once a date
// is more than 2 days old, an employee can no longer request a correction
// for it through this flow at all (must be handled outside the system).
//
// `requestedStatus`/`requestedEarlyDeparture`, when present, are what turns
// this into a structured "apply for leave" request (frontendall) instead of
// the free-text ask (frontendems) — and route it through
// resolveApprovalStage above. The two have opposite date directions: the
// free-text flow only ever corrects a day that's already happened, so a
// future date makes no sense there — but applying for leave *in advance* is
// the entire point of the structured flow, so future dates are only
// rejected for the free-text case (neither field set). Both still share the
// same 2-day backdating cutoff.
async function createRequest(employeeId, { date, endDate, reason, requestedStatus, requestedEarlyDeparture }) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const normalizedDate = new Date(date);
  if (Number.isNaN(normalizedDate.getTime())) throw ApiError.badRequest('Invalid date');

  // endDate only ever comes from the structured "apply for leave" flow — a
  // multi-day span, applied uniformly to every day on resolution (see
  // resolveRequest below). Missing/absent means a plain single-day request,
  // same as before this field existed.
  let normalizedEndDate = normalizedDate;
  if (endDate) {
    normalizedEndDate = new Date(endDate);
    if (Number.isNaN(normalizedEndDate.getTime())) throw ApiError.badRequest('Invalid end date');
    if (normalizedEndDate.getTime() < normalizedDate.getTime()) {
      throw ApiError.badRequest('End date cannot be before the start date');
    }
    const spanDays = (normalizedEndDate.getTime() - normalizedDate.getTime()) / MS_PER_DAY + 1;
    if (spanDays > MAX_LEAVE_SPAN_DAYS) {
      throw ApiError.badRequest(`Cannot apply for more than ${MAX_LEAVE_SPAN_DAYS} days at once`);
    }
  }

  const isLeaveApplication = Boolean(requestedStatus || requestedEarlyDeparture);
  const today = todayUTCMidnight();
  if (!isLeaveApplication && normalizedDate.getTime() > today.getTime()) {
    throw ApiError.badRequest('Cannot request a modification for a future date');
  }
  const ageDays = (today.getTime() - normalizedDate.getTime()) / MS_PER_DAY;
  if (ageDays > REQUEST_SUBMISSION_CUTOFF_DAYS) {
    throw ApiError.badRequest('Cannot request a modification for a date more than 2 days old');
  }

  if (requestedStatus === ATTENDANCE_STATUS.PAID_LEAVE) {
    const eligible = await isEligibleForPaidLeave(employeeId, normalizedDate);
    if (!eligible) {
      throw ApiError.conflict('Only one paid leave is allowed per month, and it has already been used or applied for this month');
    }
  }

  const { stage, cmIds } = await resolveApprovalStage(employeeId, isLeaveApplication);

  const request = await attendanceRequestRepository.create({
    employee: employeeId,
    date: normalizedDate,
    endDate: normalizedEndDate,
    reason,
    requestedStatus,
    requestedEarlyDeparture,
    approvalStage: stage,
  });

  const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();

  if (stage === ATTENDANCE_REQUEST_APPROVAL_STAGE.CONTENT_MANAGER) {
    const cmUserIds = await notifyRecipients.resolveUserIdsForEmployees(cmIds);
    await notificationService.createForUsers(cmUserIds, {
      type: NOTIFICATION_TYPES.LEAVE_APPLICATION_PENDING_CM_REVIEW,
      title: 'Leave application needs your review',
      message: `${employeeName} applied for leave starting ${date}: ${reason}`,
      employee: employeeId,
    });
  } else {
    const hrUsers = await userRepository.findHr();
    await notificationService.createForUsers(
      hrUsers.map((u) => u._id),
      {
        type: NOTIFICATION_TYPES.ATTENDANCE_MODIFICATION_REQUESTED,
        title: 'Attendance modification requested',
        message: `${employeeName} requested a change to their attendance on ${date}: ${reason}`,
        employee: employeeId,
      }
    );
  }

  return request;
}

async function listRequests({ employeeId, status } = {}) {
  return attendanceRequestRepository.list({ employeeId, status });
}

// Resolving is the actual correction — attendanceUpdate is optional
// (status/overtimeMinutes/isLate), applied to every day from request.date to
// request.endDate (inclusive — the same single day for a plain correction
// request, since endDate defaults to date) and tagged modifiedByRequest:
// true on each, which is what makes the calendar show "Modified by HR" on
// that day. A request can sit pending for a few days, so the date range's
// age is checked fresh here (at resolution time), not at submission time —
// the same 2-day HR cutoff used by direct marking
// (attendance.service.js#markAttendance) applies here too, since this writes
// to the same AttendanceRecord via a different path. Checked for every day
// in the range before touching any of them, so a cutoff failure partway
// through a multi-day span never leaves a partial edit behind.
//
// Before applying any change, each date's current AttendanceRecord (if any)
// is snapshotted onto the request as a {date, snapshot} array — this is the
// only thing that makes revokeRequest below able to undo this
// non-destructively later, one day at a time.
async function resolveRequest(id, resolvedByUserId, attendanceUpdate, actingUserRole) {
  const request = await attendanceRequestRepository.findById(id);
  if (!request) throw ApiError.notFound('Attendance modification request not found');
  if (request.status !== ATTENDANCE_REQUEST_STATUS.PENDING) {
    throw ApiError.conflict('This request has already been handled');
  }
  if (request.approvalStage === ATTENDANCE_REQUEST_APPROVAL_STAGE.CONTENT_MANAGER) {
    throw ApiError.conflict('This request is still awaiting content manager review');
  }

  const hasChange =
    attendanceUpdate &&
    (attendanceUpdate.status ||
      attendanceUpdate.overtimeMinutes !== undefined ||
      attendanceUpdate.isLate !== undefined ||
      attendanceUpdate.earlyDeparture !== undefined);

  let previousRecordSnapshot = null;
  if (hasChange) {
    const dates = enumerateDates(request.date, request.endDate || request.date);
    for (const date of dates) {
      attendanceService.assertCanEditAttendanceDate(actingUserRole, date);
    }

    previousRecordSnapshot = [];
    for (const date of dates) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await attendanceRepository.findForDate(request.employee, date);
      previousRecordSnapshot.push({
        date,
        snapshot: existing
          ? {
              status: existing.status,
              overtimeMinutes: existing.overtimeMinutes,
              isLate: existing.isLate,
              earlyDeparture: existing.earlyDeparture,
              notes: existing.notes,
            }
          : null,
      });
      // eslint-disable-next-line no-await-in-loop
      await attendanceRepository.upsertForDate(request.employee, date, attendanceUpdate, false, false, true);
    }
  }

  return attendanceRequestRepository.resolve(id, resolvedByUserId, {
    attendanceWasModified: Boolean(hasChange),
    previousRecordSnapshot,
  });
}

// Is `cmEmployeeId` an eligible Content Manager for `applicantEmployeeId`'s
// leave application — i.e. tagged content_manager on any team the applicant
// belongs to? Backs both the route-level access check on cm-approve/reject
// and (indirectly, via listPendingForContentManager) the CM's dashboard
// queue.
async function isEligibleContentManagerFor(applicantEmployeeId, cmEmployeeId) {
  if (!cmEmployeeId) return false;
  const teams = await workTeamRepository.listForMember(applicantEmployeeId);
  return teams.some((t) => teamRoles.hasRole(t, cmEmployeeId, TEAM_MEMBER_ROLE.CONTENT_MANAGER));
}

// Advances a request out of the Content Manager stage — the request stays
// 'pending' throughout (it's still awaiting a decision, just from a
// different tier now), and this is the only thing that changes. HR is
// notified fresh here, exactly the same notification the flat single-tier
// flow already sends, just deferred until now instead of firing at
// submission time.
async function approveAtContentManagerStage(id, actingUserId) {
  const request = await attendanceRequestRepository.findById(id);
  if (!request) throw ApiError.notFound('Attendance modification request not found');
  if (request.status !== ATTENDANCE_REQUEST_STATUS.PENDING) {
    throw ApiError.conflict('This request has already been handled');
  }
  if (request.approvalStage !== ATTENDANCE_REQUEST_APPROVAL_STAGE.CONTENT_MANAGER) {
    throw ApiError.conflict('This request is not awaiting content manager review');
  }

  const updated = await attendanceRequestRepository.advanceToHrStage(id, actingUserId);

  const employee = await employeeRepository.findById(request.employee);
  const employeeName = employee ? `${employee.firstName} ${employee.lastName || ''}`.trim() : 'An employee';
  const hrUsers = await userRepository.findHr();
  await notificationService.createForUsers(
    hrUsers.map((u) => u._id),
    {
      type: NOTIFICATION_TYPES.ATTENDANCE_MODIFICATION_REQUESTED,
      title: 'Attendance modification requested',
      message: `${employeeName}'s leave application was approved by their content manager and now needs HR review.`,
      employee: request.employee,
    }
  );

  return updated;
}

// Every request currently sitting at the Content Manager stage for any
// employee on a team this person is tagged content_manager on — the CM's
// dashboard "pending my review" queue. Returns [] for anyone not tagged
// content_manager anywhere, rather than erroring.
async function listPendingForContentManager(cmEmployeeId) {
  const teams = await workTeamRepository.listWhereEmployeeIsContentManager(cmEmployeeId);
  if (teams.length === 0) return [];
  const employeeIds = [...new Set(teams.flatMap((t) => [t.leader, ...t.members].map((id) => id.toString())))];
  return attendanceRequestRepository.list({
    status: ATTENDANCE_REQUEST_STATUS.PENDING,
    approvalStage: ATTENDANCE_REQUEST_APPROVAL_STAGE.CONTENT_MANAGER,
    employeeIds,
  });
}

// A request denied outright — no AttendanceRecord is ever touched, so there
// is nothing for revokeRequest to act on later (it only accepts requests
// currently in the 'resolved' state).
async function rejectRequest(id, resolvedByUserId, reason) {
  const request = await attendanceRequestRepository.findById(id);
  if (!request) throw ApiError.notFound('Attendance modification request not found');
  if (request.status !== ATTENDANCE_REQUEST_STATUS.PENDING) {
    throw ApiError.conflict('This request has already been handled');
  }
  return attendanceRequestRepository.reject(id, resolvedByUserId, reason);
}

// previousRecordSnapshot is an array of {date, snapshot} for any request
// resolved after multi-day support was added — but requests resolved before
// that (already sitting in the database as 'resolved', not yet revoked)
// stored a single snapshot object tied to request.date. Normalizing here
// keeps revoke working for both without a migration.
function snapshotEntries(request) {
  if (Array.isArray(request.previousRecordSnapshot)) return request.previousRecordSnapshot;
  return [{ date: request.date, snapshot: request.previousRecordSnapshot }];
}

// Undoes an approval non-destructively: restores each day's AttendanceRecord
// to exactly the snapshot captured at resolution time (or, if that snapshot
// was null, brings the record back to that same unmarked shell) — never
// deletes the AttendanceRecord or the request document itself. Only valid
// from 'resolved', so a rejected or already-revoked request can't be
// revoked again.
async function revokeRequest(id, revokedByUserId, actingUserRole) {
  const request = await attendanceRequestRepository.findById(id);
  if (!request) throw ApiError.notFound('Attendance modification request not found');
  if (request.status !== ATTENDANCE_REQUEST_STATUS.RESOLVED) {
    throw ApiError.conflict('Only an approved request can be revoked');
  }
  if (request.attendanceWasModified) {
    const entries = snapshotEntries(request);
    for (const { date } of entries) {
      attendanceService.assertCanEditAttendanceDate(actingUserRole, date);
    }
    for (const { date, snapshot } of entries) {
      // eslint-disable-next-line no-await-in-loop
      await attendanceRepository.applySnapshot(request.employee, date, snapshot);
    }
  }
  return attendanceRequestRepository.revoke(id, revokedByUserId);
}

// Self-only — verified against the request's own employee, not trusted from
// the client, same reasoning as every other self-scoped endpoint.
async function acknowledgeRequest(id, employeeId) {
  const request = await attendanceRequestRepository.findById(id);
  if (!request) throw ApiError.notFound('Attendance modification request not found');
  if (request.employee.toString() !== employeeId) throw ApiError.forbidden();
  return attendanceRequestRepository.markSeen(id);
}

async function listUnseenForEmployee(employeeId) {
  return attendanceRequestRepository.listUnseenForEmployee(employeeId);
}

module.exports = {
  createRequest,
  listRequests,
  resolveRequest,
  rejectRequest,
  revokeRequest,
  acknowledgeRequest,
  listUnseenForEmployee,
  checkPaidLeaveEligibility,
  isEligibleContentManagerFor,
  approveAtContentManagerStage,
  listPendingForContentManager,
};
