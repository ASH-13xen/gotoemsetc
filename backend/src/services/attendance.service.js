const ApiError = require('../utils/ApiError');
const employeeRepository = require('../repositories/employee.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const activityService = require('./activity.service');

function todayUTCMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// `dateStr` is a plain 'YYYY-MM-DD' string, which the spec guarantees parses
// as UTC midnight — kept consistent with todayUTCMidnight() so the backdated
// comparison never drifts by a day depending on the server's local timezone.
async function markAttendance(employeeId, dateStr, { status, overtimeHours, notes }) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('Invalid date');

  const today = todayUTCMidnight();
  if (date.getTime() > today.getTime()) {
    throw ApiError.badRequest('Cannot mark attendance for a future date');
  }

  const isBackdated = date.getTime() < today.getTime();

  const record = await attendanceRepository.upsertForDate(employeeId, date, { status, overtimeHours, notes }, isBackdated);
  await activityService.log(employeeId, 'ATTENDANCE_MARKED', { date: dateStr, status, overtimeHours, isBackdated });
  return record;
}

async function listForEmployee(employeeId, { month, year }) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const now = new Date();
  const y = year || now.getUTCFullYear();
  const m = month ? month - 1 : now.getUTCMonth();

  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 0));

  return attendanceRepository.listForEmployee(employeeId, { from, to });
}

module.exports = { markAttendance, listForEmployee };
