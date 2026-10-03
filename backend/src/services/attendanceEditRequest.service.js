const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const AttendanceEditRequest = require('../models/AttendanceEditRequest');
const employeeRepository = require('../repositories/employee.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const userRepository = require('../repositories/user.repository');
const attendanceService = require('./attendance.service');
const notificationService = require('./notification.service');
const { USER_ROLES, NOTIFICATION_TYPES, ATTENDANCE_EDIT_REQUEST_STATUS } = require('../config/constants');

// HR can't change attendance more than 2 days old directly. They send the
// change here instead; only the CEO and admin see these, and whichever of
// them approves first applies it exactly as HR asked (re-checked against
// every attendance rule at that moment). Rejecting leaves the day alone.

const { PENDING, APPROVED, REJECTED } = ATTENDANCE_EDIT_REQUEST_STATUS;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const POPULATE = [
  { path: 'employee', select: 'firstName lastName employeeCode designation' },
  { path: 'requestedBy', select: 'username role' },
  { path: 'decidedBy', select: 'username role' },
];

const canDecide = (user) => user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.CEO;
const dayStr = (date) => date.toISOString().slice(0, 10);
const nameOf = (employee) => `${employee.firstName} ${employee.lastName || ''}`.trim();

function todayUTCMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function describeChange(change) {
  const parts = [];
  if (change.status) parts.push(change.status === 'O' ? `status O (${change.paidLeaveAwarded ? 'awarded' : 'own'} paid leave)` : `status ${change.status}`);
  if (change.overtimeMinutes !== undefined && change.overtimeMinutes !== null) parts.push(`${change.overtimeMinutes} min overtime`);
  if (change.isLate !== undefined && change.isLate !== null) parts.push(change.isLate ? 'late' : 'not late');
  if (change.earlyDeparture !== undefined && change.earlyDeparture !== null) parts.push(change.earlyDeparture ? 'left early' : 'no early departure');
  return parts.join(', ') || 'no change';
}

async function create(user, { employeeId, date: dateStr, reason, ...change }) {
  if (user.role !== USER_ROLES.HR) {
    throw ApiError.forbidden('Only HR sends change requests — admin and the CEO can edit attendance directly');
  }
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const ageDays = (todayUTCMidnight().getTime() - date.getTime()) / MS_PER_DAY;
  if (ageDays <= attendanceService.HR_EDIT_CUTOFF_DAYS) {
    throw ApiError.badRequest('This day is within the last 2 days — you can change it directly');
  }

  // Fail now rather than at approval if it breaks a rule (overtime without
  // a status, a second own paid leave in the month, probation…).
  await attendanceService.validateAttendanceChange(employee, date, change);

  const existingRequest = await AttendanceEditRequest.findOne({ employee: employeeId, date, status: PENDING });
  if (existingRequest) {
    throw ApiError.conflict('There is already a change request waiting for this day — wait for it to be decided first');
  }

  const current = await attendanceRepository.findForDate(employeeId, date);
  const request = await AttendanceEditRequest.create({
    employee: employeeId,
    date,
    change,
    reason,
    requestedBy: user.id,
    previous: current
      ? {
          status: current.status ?? null,
          overtimeMinutes: current.overtimeMinutes ?? 0,
          isLate: Boolean(current.isLate),
          earlyDeparture: Boolean(current.earlyDeparture),
          paidLeaveAwarded: Boolean(current.paidLeaveAwarded),
        }
      : null,
  });

  const [admins, ceos] = await Promise.all([userRepository.findAdmins(), userRepository.findCeos()]);
  await notificationService.createForUsers([...admins, ...ceos].map((u) => u._id), {
    type: NOTIFICATION_TYPES.ATTENDANCE_EDIT_REQUESTED,
    title: 'HR asks to change old attendance',
    message: `${nameOf(employee)} on ${dateStr}: ${describeChange(change)}. Reason: ${reason}`,
    employee: employeeId,
  });

  return AttendanceEditRequest.findById(request._id).populate(POPULATE);
}

// CEO/admin: every request (pending first). HR: only their own.
async function list(user, { status, employeeId } = {}) {
  const query = {};
  if (!canDecide(user)) {
    if (user.role !== USER_ROLES.HR) throw ApiError.forbidden();
    query.requestedBy = user.id;
  }
  if (status) query.status = status;
  if (employeeId) query.employee = employeeId;
  return AttendanceEditRequest.find(query).sort({ status: 1, createdAt: -1 }).limit(200).populate(POPULATE);
}

async function decide(user, id, { approve, note }) {
  if (!canDecide(user)) throw ApiError.forbidden('Only the CEO or admin can decide these requests');
  const request = await AttendanceEditRequest.findById(id).populate('employee', 'firstName lastName');
  if (!request) throw ApiError.notFound('Request not found');
  if (request.status !== PENDING) throw ApiError.conflict('This request has already been decided');

  if (approve) {
    // Applied as the approver — no 2-day limit for the CEO/admin, and every
    // other rule is checked again now.
    const change = request.change?.toObject ? request.change.toObject() : request.change || {};
    await attendanceService.markAttendance(
      request.employee._id.toString(),
      dayStr(request.date),
      { ...change, notes: `${request.reason} (HR request, approved by ${user.username || user.role})` },
      user.role
    );
  }

  request.status = approve ? APPROVED : REJECTED;
  request.decidedBy = user.id;
  request.decidedAt = new Date();
  request.decisionNote = note;
  await request.save();

  notificationService
    .createForUsers([request.requestedBy], {
      type: NOTIFICATION_TYPES.ATTENDANCE_EDIT_REQUEST_DECIDED,
      title: approve ? 'Attendance change approved' : 'Attendance change rejected',
      message: `${nameOf(request.employee)} on ${dayStr(request.date)}: ${describeChange(request.change || {})}${
        approve ? ' — applied.' : '.'
      }${note ? ` Note: ${note}` : ''}`,
      employee: request.employee._id,
    })
    .catch((err) => logger.error({ err }, 'edit request decision notification failed'));

  return AttendanceEditRequest.findById(id).populate(POPULATE);
}

module.exports = { create, list, decide, describeChange };
