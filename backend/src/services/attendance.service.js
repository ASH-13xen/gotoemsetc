const ApiError = require('../utils/ApiError');
const employeeRepository = require('../repositories/employee.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const holidayRepository = require('../repositories/holiday.repository');
const userRepository = require('../repositories/user.repository');
const activityService = require('./activity.service');
const notificationService = require('./notification.service');
const { dateKey, isOffDay } = require('../utils/attendanceDays');
const { ATTENDANCE_STATUS, USER_ROLES, NOTIFICATION_TYPES } = require('../config/constants');
const { computeEffectiveUnits } = require('../utils/attendancePenalties');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HR_EDIT_CUTOFF_DAYS = 2;

function todayUTCMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Admin can edit attendance for any date, anytime. HR is admin-equivalent
// everywhere else in the app, but cannot touch a date more than 2 days old —
// called from both direct marking (markAttendance) and request resolution
// (attendanceRequest.service.js#resolveRequest, which writes to the same
// AttendanceRecord via a different path and would otherwise bypass this).
function assertCanEditAttendanceDate(actingUserRole, date) {
  if (actingUserRole !== USER_ROLES.HR) return;
  const ageDays = (todayUTCMidnight().getTime() - date.getTime()) / MS_PER_DAY;
  if (ageDays > HR_EDIT_CUTOFF_DAYS) {
    throw ApiError.forbidden('HR cannot modify attendance older than 2 days');
  }
}

// HR (not admin) must justify every manual attendance edit — a required
// reason, surfaced to admins as a notification for oversight. Admin edits
// need no reason: admin already has unrestricted access (see
// assertCanEditAttendanceDate), so this is specifically about HR being
// answerable for changes within the trust admin has extended to them.
function assertReasonProvidedForHr(actingUserRole, notes) {
  if (actingUserRole !== USER_ROLES.HR) return;
  if (!notes || !notes.trim()) {
    throw ApiError.badRequest('HR must provide a reason when marking attendance manually');
  }
}

// `dateStr` is a plain 'YYYY-MM-DD' string, which the spec guarantees parses
// as UTC midnight — kept consistent with todayUTCMidnight() so the backdated
// comparison never drifts by a day depending on the server's local timezone.
async function markAttendance(employeeId, dateStr, { status, overtimeMinutes, notes, isLate, earlyDeparture }, actingUserRole) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('Invalid date');

  const today = todayUTCMidnight();
  if (date.getTime() > today.getTime()) {
    throw ApiError.badRequest('Cannot mark attendance for a future date');
  }
  assertCanEditAttendanceDate(actingUserRole, date);
  assertReasonProvidedForHr(actingUserRole, notes);

  const isBackdated = date.getTime() < today.getTime();

  const record = await attendanceRepository.upsertForDate(
    employeeId,
    date,
    { status, overtimeMinutes, notes, isLate, earlyDeparture },
    isBackdated
  );
  await activityService.log(employeeId, 'ATTENDANCE_MARKED', {
    date: dateStr,
    status,
    overtimeMinutes,
    isLate,
    earlyDeparture,
    isBackdated,
    notes,
  });

  if (actingUserRole === USER_ROLES.HR) {
    const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
    const admins = await userRepository.findAdmins();
    await notificationService.createForUsers(
      admins.map((a) => a._id),
      {
        type: NOTIFICATION_TYPES.ATTENDANCE_MANUAL_EDIT,
        title: 'HR edited attendance',
        message: `HR marked ${employeeName}'s attendance for ${dateStr}. Reason: ${notes}`,
        employee: employeeId,
      }
    );
  }

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

function emptySummary(dateOfJoining, asOfDate, periodStart) {
  const counts = Object.fromEntries(Object.values(ATTENDANCE_STATUS).map((s) => [s, 0]));
  return {
    dateOfJoining,
    asOfDate,
    periodStart: periodStart ?? asOfDate,
    totalWorkingDays: 0,
    unmarkedDays: 0,
    counts,
    lateFlagCount: 0,
    earlyDepartureCount: 0,
    lateToSLUnits: 0,
    effectiveSLUnits: 0,
    halfDayPenaltyUnits: 0,
    totalOvertimeMinutes: 0,
  };
}

// Every working day in [from, to], split into unmarked vs. each attendance
// status, plus the Late/SL/Half-Day conversion breakdown (see
// attendancePenalties.js) — used both for the "Overall" (from = date of
// joining) and the Current/Previous Month toggle on the Attendance page's
// summary card. Separate from the month-by-month calendar underneath it.
async function computeLifetimeSummary(employeeId, { from: fromOverride, to: toOverride } = {}) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const today = todayUTCDateOnly();
  const to = toOverride ? startOfUTCDate(toOverride) : today;

  if (!fromOverride && !employee.dateOfJoining) {
    return emptySummary(null, to);
  }

  let from = fromOverride
    ? startOfUTCDate(fromOverride)
    : startOfUTCDate(new Date(employee.dateOfJoining));
  // Clamp to the employee's actual date of joining — a Current/Previous
  // Month range that starts before they were hired would otherwise count
  // pre-employment days as "working days" they left unmarked (inflating
  // totalWorkingDays/unmarkedDays past what the correctly-anchored
  // "Overall" view shows for the same employee).
  if (employee.dateOfJoining) {
    const joinDate = startOfUTCDate(new Date(employee.dateOfJoining));
    if (joinDate.getTime() > from.getTime()) from = joinDate;
  }
  if (from.getTime() > to.getTime()) {
    // The whole requested period is before they joined (e.g. "Previous
    // Month" for someone hired this month) — nothing to report, not 0
    // days worked out of some inflated working-day count.
    return emptySummary(employee.dateOfJoining, to, from);
  }

  const [records, holidays] = await Promise.all([
    attendanceRepository.listForEmployee(employeeId, { from, to }),
    holidayRepository.list({ from, to }),
  ]);

  const holidayDateKeys = new Set(holidays.map((h) => dateKey(h.date)));
  const recordByDate = new Map(records.map((r) => [dateKey(r.date), r]));

  const counts = Object.fromEntries(Object.values(ATTENDANCE_STATUS).map((s) => [s, 0]));
  let totalWorkingDays = 0;
  let unmarkedDays = 0;
  let lateFlagCount = 0;
  let earlyDepartureCount = 0;
  for (const cursor = new Date(from); cursor.getTime() <= to.getTime(); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (isOffDay(cursor, holidayDateKeys)) continue;
    totalWorkingDays += 1;
    const record = recordByDate.get(dateKey(cursor));
    if (record && record.status) {
      counts[record.status] += 1;
    } else {
      unmarkedDays += 1;
    }
    if (record?.isLate) lateFlagCount += 1;
    if (record?.earlyDeparture) earlyDepartureCount += 1;
  }

  // Summed straight off every fetched record, not the working-days-only
  // cursor loop above — overtime can be earned on a Sunday/Holiday too (see
  // attendanceClassifier.service.js#computeOffDayOvertime), which that loop
  // deliberately skips.
  let totalOvertimeMinutes = 0;
  for (const record of records) {
    totalOvertimeMinutes += record.overtimeMinutes || 0;
  }

  const { lateToSLUnits, effectiveSLUnits, halfDayPenaltyUnits } = computeEffectiveUnits({
    counts,
    lateFlagCount,
    earlyDepartureCount,
  });

  return {
    dateOfJoining: employee.dateOfJoining,
    asOfDate: to,
    periodStart: from,
    totalWorkingDays,
    unmarkedDays,
    counts,
    lateFlagCount,
    earlyDepartureCount,
    lateToSLUnits,
    effectiveSLUnits,
    halfDayPenaltyUnits,
    totalOvertimeMinutes,
  };
}

// Which employees already have today's attendance marked — drives the
// Attendance page's "already marked" indicator and bottom-of-list sort.
async function listMarkedTodayEmployeeIds() {
  return attendanceRepository.listEmployeeIdsForDate(todayUTCMidnight());
}

// HR Work's org-wide "All merged attendance" monthly overview (frontendhr) —
// every employee's records for one calendar month in a single flat list.
// Deliberately returns raw records rather than a pre-grouped-by-date
// structure: the frontend already has day-grid-building logic (see
// CalendarPage.tsx's pattern) and also needs to apply its own overtime-toggle
// filtering, so grouping here would just be redone client-side anyway.
async function getMonthlyOverview({ month, year }) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  const records = await attendanceRepository.listAllForRange(from, to);
  return records.filter((r) => r.employee && !r.employee.isDeleted);
}

// The company calendar's "who's out" layer — open to every logged-in user,
// unlike getMonthlyOverview above (HR-only). Deliberately narrower than a
// full monthly overview: only the statuses that mean "not fully at their
// desk in the normal way" (Paid Leave, Half Day, Short Leave, Work From
// Home) plus the earlyDeparture flag, which is independent of status. Late
// is excluded on purpose — it isn't "out" — and so is Absent, since it's
// unapproved, not something to broadcast company-wide. Holiday is excluded
// too — the calendar's separate Holiday marker already covers that day for
// everyone, so repeating it here would just show "everyone is out" on every
// holiday. Sourced from AttendanceRecord directly (not from leave requests)
// so it also reflects leave HR marks by hand, outside the request flow.
const WHOS_OUT_STATUSES = [
  ATTENDANCE_STATUS.PAID_LEAVE,
  ATTENDANCE_STATUS.HALF_DAY,
  ATTENDANCE_STATUS.SHORT_LEAVE,
  ATTENDANCE_STATUS.WORK_FROM_HOME,
];

async function listWhosOutForMonth({ month, year }) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  const records = await attendanceRepository.listAllForRange(from, to);
  return records
    .filter((r) => r.employee && !r.employee.isDeleted)
    .filter((r) => WHOS_OUT_STATUSES.includes(r.status) || r.earlyDeparture)
    .map((r) => ({
      employee: { _id: r.employee._id, firstName: r.employee.firstName, lastName: r.employee.lastName },
      date: r.date,
      status: WHOS_OUT_STATUSES.includes(r.status) ? r.status : null,
      earlyDeparture: Boolean(r.earlyDeparture),
    }));
}

module.exports = {
  markAttendance,
  listForEmployee,
  computeLifetimeSummary,
  listMarkedTodayEmployeeIds,
  getMonthlyOverview,
  listWhosOutForMonth,
  assertCanEditAttendanceDate,
};
