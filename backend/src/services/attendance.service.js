const ApiError = require('../utils/ApiError');
const employeeRepository = require('../repositories/employee.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const holidayRepository = require('../repositories/holiday.repository');
const userRepository = require('../repositories/user.repository');
const activityService = require('./activity.service');
const notificationService = require('./notification.service');
const { dateKey, isOffDay, isSunday } = require('../utils/attendanceDays');
const { ATTENDANCE_STATUS, USER_ROLES, NOTIFICATION_TYPES } = require('../config/constants');
const { computeEffectiveUnits } = require('../utils/attendancePenalties');
const { isPastProbation } = require('../utils/probation');
const { can, hasRole, isSelf } = require('../utils/roles');
const { ACCESS, GRANTS } = require('../config/access');
const accessService = require('./access.service');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HR_EDIT_CUTOFF_DAYS = 2;

function todayUTCMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// HR — by login or by holding the HR post — can only change the last 2 days,
// unless they also hold access without that limit (CEO/admin): the less
// restricted rule wins. Called from both direct marking (markAttendance)
// and request resolution (attendanceRequest.service.js#resolveRequest,
// which writes to the same AttendanceRecord by a different path).
const isTimeLimitedHr = (actor) => hasRole(actor, USER_ROLES.HR) && !can(actor, ACCESS.ATTENDANCE_NO_TIME_LIMIT);

function assertCanEditAttendanceDate(actor, date) {
  if (!isTimeLimitedHr(actor)) return;
  const ageDays = (todayUTCMidnight().getTime() - date.getTime()) / MS_PER_DAY;
  if (ageDays > HR_EDIT_CUTOFF_DAYS) {
    throw ApiError.forbidden(
      'HR cannot change attendance older than 2 days directly — send it as a change request for the CEO or admin to approve'
    );
  }
}

// HR (not admin) must justify every manual attendance edit — a required
// reason, surfaced to admins as a notification for oversight. Admin edits
// need no reason: admin already has unrestricted access (see
// assertCanEditAttendanceDate), so this is specifically about HR being
// answerable for changes within the trust admin has extended to them.
function assertReasonProvidedForHr(actor, notes) {
  if (!isTimeLimitedHr(actor)) return;
  if (!notes || !notes.trim()) {
    throw ApiError.badRequest('HR must provide a reason when marking attendance manually');
  }
}

// Overtime can never sit on a working day without a status — that left a
// day looking "attended" (it had a record) while carrying no attendance at
// all, which payroll then treats as unpaid. Checked against what the record
// will look like after the write: `update.status` when given, otherwise
// the status already on the record. Sundays and holidays are exempt — work
// on an off day is recorded purely as overtime, with no status, by design
// (see attendanceClassifier.service.js#computeOffDayOvertime).
async function assertStatusForOvertime(employeeId, date, update = {}) {
  const existing = await attendanceRepository.findForDate(employeeId, date);
  const overtimeMinutes =
    update.overtimeMinutes !== undefined ? Number(update.overtimeMinutes) : existing?.overtimeMinutes || 0;
  const status = update.status !== undefined ? update.status : existing?.status;
  if (!overtimeMinutes || status) return;

  const holidays = await holidayRepository.list({ from: date, to: date });
  if (isOffDay(date, new Set(holidays.map((h) => dateKey(h.date))))) return;
  throw ApiError.badRequest(
    `Overtime can't be recorded without an attendance status on a working day (${dateKey(date)}) — choose a status too`
  );
}

const fullName = (employee) => `${employee.firstName} ${employee.lastName || ''}`.trim();

// Paid off (status O): only once probation is complete, and at most ONE per
// calendar month — whether the employee applied for it or HR gave it makes
// no difference. `dates` are the days about to become O; those same days'
// current records are left out of the count, so re-saving a day doesn't
// trip over itself.
async function assertPaidOffAllowed(employee, dates) {
  const name = fullName(employee);
  if (!isPastProbation(employee)) {
    throw ApiError.conflict(`${name}'s probation isn't marked as completed, so they can't have a paid off yet`);
  }
  const byMonth = new Map();
  for (const date of dates) {
    const key = dateKey(date).slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) || []), date]);
  }
  for (const [month, monthDates] of byMonth) {
    if (monthDates.length > 1) {
      throw ApiError.conflict(`Only one paid off a month is allowed — ${name} can't have ${monthDates.length} in ${month}`);
    }
    const [y, m] = month.split('-').map(Number);
    // eslint-disable-next-line no-await-in-loop
    const records = await attendanceRepository.listForEmployee(employee._id, {
      from: new Date(Date.UTC(y, m - 1, 1)),
      to: new Date(Date.UTC(y, m, 0)),
    });
    const skip = new Set(monthDates.map(dateKey));
    const taken = records.find((r) => r.status === ATTENDANCE_STATUS.PAID_LEAVE && !skip.has(dateKey(r.date)));
    if (taken) {
      throw ApiError.conflict(
        `${name} already has this month's paid off (${dateKey(taken.date)}${taken.autoPaidOffNote ? ', converted automatically from an absent' : ''}) — only one a month is allowed`
      );
    }
  }
}

// Every rule a manual change must pass, apart from who may make it and how
// far back — shared by direct marking and by HR's change requests (checked
// both when HR asks and again when the CEO/admin approves).
async function validateAttendanceChange(employee, date, { status, overtimeMinutes }) {
  // Paid off is the only thing that can be set ahead of time — everything
  // else describes a day that has actually happened.
  if (date.getTime() > todayUTCMidnight().getTime() && status !== ATTENDANCE_STATUS.PAID_LEAVE) {
    throw ApiError.badRequest('Only a paid off can be marked for a future date');
  }
  // Sundays are always off and carry no status — time worked on one is
  // recorded as overtime only (and is paid on top of the Sunday itself).
  if (status && isSunday(date)) {
    throw ApiError.badRequest("Sundays don't take a status — record any time worked as overtime minutes only");
  }
  await assertStatusForOvertime(employee._id, date, { status, overtimeMinutes });
  if (status === ATTENDANCE_STATUS.PAID_LEAVE) {
    await assertPaidOffAllowed(employee, [date]);
  }
}

// `dateStr` is a plain 'YYYY-MM-DD' string, which the spec guarantees parses
// as UTC midnight — kept consistent with todayUTCMidnight() so the backdated
// comparison never drifts by a day depending on the server's local timezone.
async function markAttendance(
  employeeId,
  dateStr,
  { status, overtimeMinutes, notes, isLate, earlyDeparture },
  actor
) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');
  // Nobody changes their own attendance — HR, the CEO or admin has to.
  if (isSelf(actor, employeeId)) {
    throw ApiError.forbidden("You can't change your own attendance — someone else in HR, the CEO or admin has to");
  }

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('Invalid date');

  const today = todayUTCMidnight();
  assertCanEditAttendanceDate(actor, date);
  assertReasonProvidedForHr(actor, notes);
  await validateAttendanceChange(employee, date, { status, overtimeMinutes });

  const isBackdated = date.getTime() < today.getTime();

  const record = await attendanceRepository.upsertForDate(
    employeeId,
    date,
    {
      status,
      overtimeMinutes,
      notes,
      isLate,
      earlyDeparture,
      // Who changed it and in which role — shown only to them and the
      // people above that role (see access.service.js#canSeeAttribution).
      markedBy: actor?.id,
      markedAs: accessService.actingRole(actor, GRANTS[ACCESS.EMS_ALL]),
    },
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

  if (isTimeLimitedHr(actor)) {
    const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
    const admins = await userRepository.findAdmins();
    await notificationService.createForUsers(
      admins.map((a) => a._id),
      {
        type: NOTIFICATION_TYPES.ATTENDANCE_MANUAL_EDIT,
        title: 'HR edited attendance',
        message: `${actor.displayName || 'HR'} (HR) marked ${employeeName}'s attendance for ${dateStr}. Reason: ${notes}`,
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
  assertStatusForOvertime,
  assertPaidOffAllowed,
  validateAttendanceChange,
  HR_EDIT_CUTOFF_DAYS,
};
