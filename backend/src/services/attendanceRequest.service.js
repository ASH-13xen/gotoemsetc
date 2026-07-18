const ApiError = require('../utils/ApiError');
const attendanceRequestRepository = require('../repositories/attendanceRequest.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const employeeRepository = require('../repositories/employee.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const attendanceService = require('./attendance.service');
const { ATTENDANCE_REQUEST_STATUS, NOTIFICATION_TYPES } = require('../config/constants');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REQUEST_SUBMISSION_CUTOFF_DAYS = 2;

function todayUTCMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Requests now go to HR (not admin) to review — HR is the day-to-day
// attendance handler; admin retains full unrestricted edit access separately
// and doesn't need to be paged for every request. A hard cutoff: once a date
// is more than 2 days old, an employee can no longer request a correction
// for it through this flow at all (must be handled outside the system).
async function createRequest(employeeId, { date, reason }) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const normalizedDate = new Date(date);
  if (Number.isNaN(normalizedDate.getTime())) throw ApiError.badRequest('Invalid date');
  const today = todayUTCMidnight();
  if (normalizedDate.getTime() > today.getTime()) {
    throw ApiError.badRequest('Cannot request a modification for a future date');
  }
  const ageDays = (today.getTime() - normalizedDate.getTime()) / MS_PER_DAY;
  if (ageDays > REQUEST_SUBMISSION_CUTOFF_DAYS) {
    throw ApiError.badRequest('Cannot request a modification for a date more than 2 days old');
  }

  const request = await attendanceRequestRepository.create({ employee: employeeId, date: normalizedDate, reason });

  const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
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

  return request;
}

async function listRequests({ employeeId, status } = {}) {
  return attendanceRequestRepository.list({ employeeId, status });
}

// Resolving is the actual correction — attendanceUpdate is optional
// (status/overtimeHours/isLate), applied to that date's AttendanceRecord in
// the same step and tagged modifiedByRequest: true, which is what makes the
// calendar show "Modified by HR" on that day. A request can sit pending for
// a few days, so `request.date`'s age is checked fresh here (at resolution
// time), not at submission time — the same 2-day HR cutoff used by direct
// marking (attendance.service.js#markAttendance) applies here too, since
// this writes to the same AttendanceRecord via a different path.
async function resolveRequest(id, resolvedByUserId, attendanceUpdate, actingUserRole) {
  const request = await attendanceRequestRepository.findById(id);
  if (!request) throw ApiError.notFound('Attendance modification request not found');
  if (request.status === ATTENDANCE_REQUEST_STATUS.RESOLVED) {
    throw ApiError.conflict('This request has already been resolved');
  }

  if (
    attendanceUpdate &&
    (attendanceUpdate.status ||
      attendanceUpdate.overtimeHours !== undefined ||
      attendanceUpdate.isLate !== undefined ||
      attendanceUpdate.earlyDeparture !== undefined)
  ) {
    attendanceService.assertCanEditAttendanceDate(actingUserRole, request.date);
    await attendanceRepository.upsertForDate(
      request.employee,
      request.date,
      attendanceUpdate,
      false,
      false,
      true
    );
  }

  return attendanceRequestRepository.resolve(id, resolvedByUserId);
}

module.exports = { createRequest, listRequests, resolveRequest };
