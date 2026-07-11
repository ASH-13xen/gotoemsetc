const ApiError = require('../utils/ApiError');
const employeeRepository = require('../repositories/employee.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const holidayRepository = require('../repositories/holiday.repository');
const activityService = require('./activity.service');
const { dateKey, isOffDay } = require('../utils/attendanceDays');
const { ATTENDANCE_STATUS } = require('../config/constants');

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

function todayUTCDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfUTCDate(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Lifetime (not month-scoped) view: every working day from the employee's
// date of joining through today, split into unmarked vs. each attendance
// status — this is what's shown the moment an employee is selected on the
// Attendance page, separate from the month-by-month calendar underneath it.
async function computeLifetimeSummary(employeeId) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const counts = Object.fromEntries(Object.values(ATTENDANCE_STATUS).map((s) => [s, 0]));
  const today = todayUTCDateOnly();

  if (!employee.dateOfJoining) {
    return { dateOfJoining: null, asOfDate: today, totalWorkingDays: 0, unmarkedDays: 0, counts };
  }

  const from = startOfUTCDate(new Date(employee.dateOfJoining));
  if (from.getTime() > today.getTime()) {
    return { dateOfJoining: employee.dateOfJoining, asOfDate: today, totalWorkingDays: 0, unmarkedDays: 0, counts };
  }

  const [records, holidays] = await Promise.all([
    attendanceRepository.listForEmployee(employeeId, { from, to: today }),
    holidayRepository.list({ from, to: today }),
  ]);

  const holidayDateKeys = new Set(holidays.map((h) => dateKey(h.date)));
  const recordByDate = new Map(records.map((r) => [dateKey(r.date), r]));

  let totalWorkingDays = 0;
  let unmarkedDays = 0;
  for (const cursor = new Date(from); cursor.getTime() <= today.getTime(); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (isOffDay(cursor, holidayDateKeys)) continue;
    totalWorkingDays += 1;
    const record = recordByDate.get(dateKey(cursor));
    if (record && record.status) {
      counts[record.status] += 1;
    } else {
      unmarkedDays += 1;
    }
  }

  return { dateOfJoining: employee.dateOfJoining, asOfDate: today, totalWorkingDays, unmarkedDays, counts };
}

module.exports = { markAttendance, listForEmployee, computeLifetimeSummary };
