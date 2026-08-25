const ApiError = require('../utils/ApiError');
const attendanceWarningRepository = require('../repositories/attendanceWarning.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const devicePunchRepository = require('../repositories/devicePunch.repository');
const employeeRepository = require('../repositories/employee.repository');
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
      overtimeMinutes: record.overtimeMinutes,
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
// Present+Overtime/Single Scan tables, merging in any warnings already sent
// for that date so each warnable row can render as locked/sent instead of a
// fresh checkbox. See taskAccess's sibling comment style — this is the
// daily HR exception report, not a per-employee calendar.
async function computeDailyReport({ date } = {}) {
  // recentWorkingDays is always relative to today (not to the currently
  // viewed date), so the picker's two options stay stable no matter which
  // one HR is looking at — see attendanceWarnings.api.ts's DailyReport type.
  const [targetDate, recentDays] = await Promise.all([
    resolveTargetDate(date),
    recentWorkingDays(RECENT_WORKING_DAYS_COUNT),
  ]);

  const [records, warnings, activeEmployees] = await Promise.all([
    attendanceRepository.listForDate(targetDate),
    attendanceWarningRepository.findForDate(targetDate),
    employeeRepository.listActive(),
  ]);

  const liveRecords = records.filter((r) => r.employee && !r.employee.isDeleted);
  // Built from every category, not just WARNABLE_BUCKETS, so single_scan
  // warnings (tracked below, outside the AttendanceRecord-driven buckets)
  // still render as "already warned" instead of silently vanishing.
  const warningsByCategory = new Map(Object.values(ATTENDANCE_WARNING_CATEGORY).map((c) => [c, new Map()]));
  for (const warning of warnings) {
    warningsByCategory.get(warning.category)?.set(warning.employee.toString(), warning);
  }

  const { start, end } = istDayBoundsUTC(targetDate);
  // Union of everyone who might need a punch lookup: anyone with a record
  // today (may include an offboarded employee's final working day) plus
  // every currently active employee — the latter is needed for the
  // single-scan bucket below, which has to work for employees the
  // classifier left without a record at all.
  const employeeIdMap = new Map();
  for (const r of liveRecords) employeeIdMap.set(r.employee._id.toString(), r.employee._id);
  for (const e of activeEmployees) employeeIdMap.set(e._id.toString(), e._id);
  const employeeIds = [...employeeIdMap.values()];
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
    .filter((r) => r.status === ATTENDANCE_STATUS.PRESENT && r.overtimeMinutes > 0)
    .map((r) => toRow(r, new Map(), punchesByEmployee));

  // The classifier deliberately never writes an AttendanceRecord for a
  // single-scan day (see attendanceClassifier.service.js's "single-scan/
  // unclassified are never auto-written as a record") — so unlike every
  // other bucket above, this can't be derived from liveRecords at all; it
  // has to scan every active employee's raw punches directly. Warnable, same
  // as the WARNABLE_BUCKETS above (see ATTENDANCE_WARNING_CATEGORY.SINGLE_SCAN).
  const recordedEmployeeIds = new Set(liveRecords.map((r) => r.employee._id.toString()));
  const singleScanWarnings = warningsByCategory.get(ATTENDANCE_WARNING_CATEGORY.SINGLE_SCAN);
  result.single_scan = activeEmployees
    .filter((e) => !recordedEmployeeIds.has(e._id.toString()))
    .filter((e) => (punchesByEmployee.get(e._id.toString()) || []).length === 1)
    .map((e) => {
      const punch = punchesByEmployee.get(e._id.toString())[0];
      const warning = singleScanWarnings?.get(e._id.toString());
      return {
        employee: { _id: e._id, firstName: e.firstName, lastName: e.lastName, designation: e.designation },
        record: { overtimeMinutes: 0, isLate: false, earlyDeparture: false },
        firstPunchAt: punch.timestamp,
        lastPunchAt: punch.timestamp,
        provisional: true,
        alreadyWarned: warning ? { message: warning.message, sentBy: warning.sentBy?.username, sentAt: warning.createdAt } : null,
      };
    });

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
