const ApiError = require('../utils/ApiError');
const attendanceRequestRepository = require('../repositories/attendanceRequest.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const employeeRepository = require('../repositories/employee.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const { ATTENDANCE_REQUEST_STATUS, NOTIFICATION_TYPES } = require('../config/constants');

function todayUTCMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function createRequest(employeeId, { date, reason }) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const normalizedDate = new Date(date);
  if (Number.isNaN(normalizedDate.getTime())) throw ApiError.badRequest('Invalid date');
  if (normalizedDate.getTime() > todayUTCMidnight().getTime()) {
    throw ApiError.badRequest('Cannot request a modification for a future date');
  }

  const request = await attendanceRequestRepository.create({ employee: employeeId, date: normalizedDate, reason });

  const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
  const admins = await userRepository.findAdmins();
  await notificationService.createForUsers(
    admins.map((a) => a._id),
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

// Resolving is the admin's actual correction — attendanceUpdate is optional
// (status/overtimeHours/isLate), applied to that date's AttendanceRecord in
// the same step and tagged modifiedByRequest: true, which is what makes the
// calendar show "Modified by HR" on that day.
async function resolveRequest(id, resolvedByUserId, attendanceUpdate) {
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
