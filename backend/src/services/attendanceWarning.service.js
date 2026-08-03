const ApiError = require('../utils/ApiError');
const attendanceWarningRepository = require('../repositories/attendanceWarning.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const devicePunchRepository = require('../repositories/devicePunch.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const { istDayBoundsUTC } = require('./attendanceClassifier.service');
const { previousWorkingDay, recentWorkingDays, utcMidnight } = require('../utils/workingDays');
const { dateKey } = require('../utils/attendanceDays');

const RECENT_WORKING_DAYS_COUNT = 2; // HR's "last 2 working days" selector on the daily report
const {
  ATTENDANCE_STATUS,
  ATTENDANCE_WARNING_CATEGORY,
  ATTENDANCE_WARNING_TEMPLATES,
  NOTIFICATION_TYPES,
} = require('../config/constants');

// Categories that get a "not informed" checkbox on the daily report — the
// Present+Overtime bucket is informational only, per spec, so it's built
// separately below and never appears here.
const WARNABLE_BUCKETS = [
  {
    category: ATTENDANCE_WARNING_CATEGORY.LATE,
    matches: (r) =>
      (r.status === ATTENDANCE_STATUS.LATE || r.isLate) &&
      r.status !== ATTENDANCE_STATUS.ABSENT &&
      r.status !== ATTENDANCE_STATUS.HOLIDAY,
  },
  {
    category: ATTENDANCE_WARNING_CATEGORY.EARLY_DEPARTURE,
    matches: (r) => r.earlyDeparture && r.status !== ATTENDANCE_STATUS.ABSENT && r.status !== ATTENDANCE_STATUS.HOLIDAY,
  },
  { category: ATTENDANCE_WARNING_CATEGORY.HALF_DAY, matches: (r) => r.status === ATTENDANCE_STATUS.HALF_DAY },
  { category: ATTENDANCE_WARNING_CATEGORY.SHORT_LEAVE, matches: (r) => r.status === ATTENDANCE_STATUS.SHORT_LEAVE },
  { category: ATTENDANCE_WARNING_CATEGORY.ABSENT, matches: (r) => r.status === ATTENDANCE_STATUS.ABSENT },
];

function toRow(record, warningsByEmployee, punchesByEmployee) {
  const employee = record.employee;
  const warning = warningsByEmployee.get(employee._id.toString());
  const punches = punchesByEmployee.get(employee._id.toString()) || [];
  return {
    employee: { _id: employee._id, firstName: employee.firstName, lastName: employee.lastName, designation: employee.designation },
    record: {
      status: record.status,
      overtimeHours: record.overtimeHours,
      isLate: record.isLate,
      earlyDeparture: record.earlyDeparture,
      notes: record.notes,
    },
    // Raw biometric scan times for the day — first (arrival) and last
    // (departure) — not the classifier's filtered "valid" subset, so HR
    // sees exactly what the device recorded when reviewing a flagged row.
    firstPunchAt: punches.length > 0 ? punches[0].timestamp : null,
    lastPunchAt: punches.length > 0 ? punches[punches.length - 1].timestamp : null,
    provisional: !record.isSettled,
    alreadyWarned: warning ? { message: warning.message, sentBy: warning.sentBy?.username, sentAt: warning.createdAt } : null,
  };
}

async function resolveTargetDate(dateStr) {
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) throw ApiError.badRequest('Invalid date');
    return utcMidnight(parsed);
  }
  return previousWorkingDay();
}

// Buckets the previous working day's (or an explicit override's)
// AttendanceRecords into Late/Early Departure/Half Day/Short Leave/Absent/
// Present+Overtime tables, merging in any warnings already sent for that
// date so each warnable row can render as locked/sent instead of a fresh
// checkbox. See taskAccess's sibling comment style — this is the daily HR
// exception report, not a per-employee calendar.
async function computeDailyReport({ date } = {}) {
  // recentWorkingDays is always relative to today (not to the currently
  // viewed date), so the picker's two options stay stable no matter which
  // one HR is looking at — see attendanceWarnings.api.ts's DailyReport type.
  const [targetDate, recentDays] = await Promise.all([
    resolveTargetDate(date),
    recentWorkingDays(RECENT_WORKING_DAYS_COUNT),
  ]);

  const [records, warnings] = await Promise.all([
    attendanceRepository.listForDate(targetDate),
    attendanceWarningRepository.findForDate(targetDate),
  ]);

  const liveRecords = records.filter((r) => r.employee && !r.employee.isDeleted);
  const warningsByCategory = new Map(WARNABLE_BUCKETS.map((b) => [b.category, new Map()]));
  for (const warning of warnings) {
    warningsByCategory.get(warning.category)?.set(warning.employee.toString(), warning);
  }

  const { start, end } = istDayBoundsUTC(targetDate);
  const employeeIds = liveRecords.map((r) => r.employee._id);
  const punches = await devicePunchRepository.listForEmployeesOnDay(employeeIds, start, end);
  const punchesByEmployee = new Map();
  for (const punch of punches) {
    const key = punch.employee.toString();
    if (!punchesByEmployee.has(key)) punchesByEmployee.set(key, []);
    punchesByEmployee.get(key).push(punch);
  }

  const result = { date: targetDate, recentWorkingDays: recentDays };
  for (const bucket of WARNABLE_BUCKETS) {
    result[bucket.category] = liveRecords
      .filter((r) => bucket.matches(r))
      .map((r) => toRow(r, warningsByCategory.get(bucket.category), punchesByEmployee));
  }
  result.present_overtime = liveRecords
    .filter((r) => r.status === ATTENDANCE_STATUS.PRESENT && r.overtimeHours > 0)
    .map((r) => toRow(r, new Map(), punchesByEmployee));

  return result;
}

// The real idempotency guard is the DB unique index on
// {employee,date,category} — this catches the resulting E11000 rather than
// relying solely on a pre-check, so a double-click or a race between two HR
// sessions can't double-count the same occurrence.
async function sendWarning({ employeeId, date, category, message, sentByUserId }) {
  if (!Object.values(ATTENDANCE_WARNING_CATEGORY).includes(category)) {
    throw ApiError.badRequest('Invalid warning category');
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) throw ApiError.badRequest('Invalid date');

  let warning;
  try {
    warning = await attendanceWarningRepository.create({
      employee: employeeId,
      date: utcMidnight(parsedDate),
      category,
      message,
      sentBy: sentByUserId,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw ApiError.conflict('A warning has already been sent for this employee/date/category');
    }
    throw err;
  }

  const employeeUser = await userRepository.findByEmployeeId(employeeId);
  if (employeeUser) {
    await notificationService.createForUsers([employeeUser._id], {
      type: NOTIFICATION_TYPES.ATTENDANCE_NOT_INFORMED_WARNING,
      title: 'Attendance warning',
      message,
      employee: employeeId,
      attendanceWarning: warning._id,
    });
  }

  return warning;
}

function templatesForCategory(category) {
  return ATTENDANCE_WARNING_TEMPLATES[category] || [];
}

async function getMonthlyCounts(employeeId, { year, month }) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));

  const warnings = await attendanceWarningRepository.listForEmployeeInRange(employeeId, from, to);
  const counts = Object.fromEntries(Object.values(ATTENDANCE_WARNING_CATEGORY).map((c) => [c, 0]));
  for (const warning of warnings) counts[warning.category] += 1;

  return { year, month, counts, warnings };
}

// Login-time check — this employee's own unread not-informed-warning
// notifications, each enriched with how many times this same category has
// hit them in that warning's own month (not necessarily the calendar-
// current month, in case of a stale unacknowledged backlog).
async function listPendingWarningsForUser(user) {
  if (!user.employeeLink) return [];

  const notifications = await notificationService.listUnreadByType(
    user.id,
    NOTIFICATION_TYPES.ATTENDANCE_NOT_INFORMED_WARNING
  );

  return Promise.all(
    notifications
      .filter((n) => n.attendanceWarning)
      .map(async (n) => {
        const warning = n.attendanceWarning;
        const from = new Date(Date.UTC(warning.date.getUTCFullYear(), warning.date.getUTCMonth(), 1));
        const to = new Date(Date.UTC(warning.date.getUTCFullYear(), warning.date.getUTCMonth() + 1, 0));
        const countThisMonth = await attendanceWarningRepository.countForEmployeeCategoryInRange(
          user.employeeLink,
          warning.category,
          from,
          to
        );
        return {
          notificationId: n._id,
          category: warning.category,
          date: warning.date,
          message: n.message,
          countThisMonth,
        };
      })
  );
}

module.exports = {
  computeDailyReport,
  sendWarning,
  templatesForCategory,
  getMonthlyCounts,
  listPendingWarningsForUser,
};
