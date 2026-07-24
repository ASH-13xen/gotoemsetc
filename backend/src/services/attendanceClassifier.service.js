const employeeRepository = require('../repositories/employee.repository');
const devicePunchRepository = require('../repositories/devicePunch.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const holidayRepository = require('../repositories/holiday.repository');
const notificationService = require('./notification.service');
const userRepository = require('../repositories/user.repository');
const { dateKey, isSunday } = require('../utils/attendanceDays');
const { ATTENDANCE_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
const logger = require('../utils/logger');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Fixed for every employee, regardless of their configured working hours —
// only the grace cutoff, the late cutoff (both derived from
// workingHoursStart) and the normal/overtime split (derived from
// workingHoursEnd) move per employee.
const HALF_DAY_ARRIVAL_START = 11 * 60 + 30; // 11:30am
const HALF_DAY_ARRIVAL_END = 13 * 60 + 59; // 1:59pm
const MIDDAY_DEAD_ZONE_START = 14 * 60; // 2:00pm
const MIDDAY_DEAD_ZONE_END = 16 * 60 + 29; // 4:29pm
const EARLY_DEPARTURE_START = 16 * 60 + 30; // 4:30pm
const NIGHT_DEAD_ZONE_END = 6 * 60 + 59; // 6:59am — valid hours resume at 7:00am
const GRACE_MINUTES = 15;
const LATE_WINDOW_MINUTES = 15; // grace cutoff + this = the Late cutoff

function todayUTCMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// `dateLabel` is the UTC-midnight day marker used everywhere else in the
// attendance system (see AttendanceRecord.date) — but punches are real UTC
// instants, so classifying "arrived by 9:45am IST" needs the actual IST
// day's absolute UTC bounds, which sit 5:30 earlier than the naive UTC day.
function istDayBoundsUTC(dateLabel) {
  const start = new Date(dateLabel.getTime() - IST_OFFSET_MS);
  const end = new Date(dateLabel.getTime() + 24 * 60 * 60 * 1000 - IST_OFFSET_MS - 1);
  return { start, end };
}

function istMinutesOfDay(date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

// IST calendar day (as a dateLabel) that a punch instant falls on.
function istDateLabel(date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

function parseTimeToMinutes(hhmm) {
  const [h, m] = String(hhmm || '09:30').split(':').map(Number);
  return h * 60 + m;
}

// The only boundaries that move with an employee's configured working
// hours — everything else in this file is a fixed clock time for everyone.
function employeeBoundaries(employee) {
  const shiftStart = parseTimeToMinutes(employee.workingHoursStart);
  const shiftEnd = parseTimeToMinutes(employee.workingHoursEnd);
  const graceCutoff = shiftStart + GRACE_MINUTES;
  return {
    graceCutoff,
    lateCutoff: graceCutoff + LATE_WINDOW_MINUTES,
    shiftEnd,
    normalEnd: shiftEnd + 59,
  };
}

function isDeadZoneMinute(minutes) {
  return minutes <= NIGHT_DEAD_ZONE_END || (minutes >= MIDDAY_DEAD_ZONE_START && minutes <= MIDDAY_DEAD_ZONE_END);
}

// Drops scans that fall in either dead zone before arrival/departure are
// ever picked — a dead-zone scan never becomes anyone's "first" or "last"
// for classification, though it's always stored in DevicePunch regardless.
// Weekday-only — see validPunchesForSunday for why Sunday doesn't share the
// midday half of this.
function validPunches(punches) {
  return punches.filter((p) => !isDeadZoneMinute(istMinutesOfDay(p.timestamp)));
}

// Only the night dead zone (pre-7am junk scans) filtered out — used solely
// to find the day's earliest real activity for the 2pm auto-absent gate
// below, before the midday dead zone even comes into play.
function nonNightPunches(punches) {
  return punches.filter((p) => istMinutesOfDay(p.timestamp) > NIGHT_DEAD_ZONE_END);
}

// Sundays only exclude the night dead zone (bogus pre-7am scans) — the
// midday dead zone exists specifically to ignore lunch-break ambiguity on a
// structured workday, which doesn't apply to a Sunday's raw duration
// calculation (a 3pm scan is a perfectly valid endpoint there).
function validPunchesForSunday(punches) {
  return punches.filter((p) => istMinutesOfDay(p.timestamp) > NIGHT_DEAD_ZONE_END);
}

// The single source of truth for turning a day's punches into a result —
// used both for the real-time provisional write (handlePunchEvent) and the
// final settlement determination (settleDay), so they can never disagree.
// Weekday-only — Sundays use computeSundayOvertime instead (no arrival/
// departure windows apply there).
//
// Returns one of:
//   { outcome: 'no-scan' }               — zero non-night-junk scans all day
//   { outcome: 'late-absent' }            — first real scan at/after 2pm
//   { outcome: 'single-scan' }
//   { outcome: 'unclassified' }          — 2+ valid scans, but departure
//                                           falls outside every window this
//                                           employee has
//   { outcome: 'classified', status, earlyDeparture, overtimeHours }
function classifyPunches(punches, employee) {
  // Gate on the day's earliest real activity first — a first scan at/after
  // 2pm auto-absents the whole day regardless of what happens later, same
  // as truly never scanning at all. Both write an Absent record (see
  // settleDay) rather than leaving the day for manual review.
  const early = nonNightPunches(punches);
  if (early.length === 0) return { outcome: 'no-scan' };
  const firstPunchMinutes = Math.min(...early.map((p) => istMinutesOfDay(p.timestamp)));
  if (firstPunchMinutes >= MIDDAY_DEAD_ZONE_START) return { outcome: 'late-absent' };

  // First punch is before 2pm, so it survives the midday-dead-zone filter
  // too — valid.length is guaranteed >= 1 here.
  const valid = validPunches(punches);
  if (valid.length === 1) return { outcome: 'single-scan' };

  const { graceCutoff, lateCutoff, shiftEnd, normalEnd } = employeeBoundaries(employee);
  const arrivalMinutes = istMinutesOfDay(valid[0].timestamp);
  const departureMinutes = istMinutesOfDay(valid[valid.length - 1].timestamp);

  let status;
  if (arrivalMinutes <= graceCutoff) status = ATTENDANCE_STATUS.PRESENT;
  else if (arrivalMinutes <= lateCutoff) status = ATTENDANCE_STATUS.LATE;
  else if (arrivalMinutes < HALF_DAY_ARRIVAL_START) status = ATTENDANCE_STATUS.SHORT_LEAVE;
  else status = ATTENDANCE_STATUS.HALF_DAY; // arrivalMinutes <= HALF_DAY_ARRIVAL_END, guaranteed by the 2pm gate above

  let earlyDeparture = false;
  let overtimeHours = 0;
  let departureOk = true;
  if (departureMinutes < EARLY_DEPARTURE_START) {
    departureOk = false;
  } else if (departureMinutes < shiftEnd) {
    earlyDeparture = true;
  } else if (departureMinutes > normalEnd) {
    overtimeHours = Math.round(((departureMinutes - shiftEnd) / 60) * 2) / 2;
  }
  // else: within [shiftEnd, normalEnd] — normal, no penalty, no overtime.

  if (!departureOk) return { outcome: 'unclassified' };
  return { outcome: 'classified', status, earlyDeparture, overtimeHours };
}

// Sundays don't use the weekday arrival/departure windows at all — any time
// actually spent (first valid scan to last) becomes overtime directly,
// rounded to the nearest 0.5h, with no baseline subtraction and no 1h
// minimum (unlike weekday overtime). Only the night dead zone is filtered
// (see validPunchesForSunday) — a 3pm scan is a normal, valid Sunday
// endpoint, unlike on a weekday. Returns null when there aren't at least two
// valid scans to measure a span from — same "not enough info yet" treatment
// as the weekday single-scan/no-scan cases, just without a notification
// (see settleDay — a quiet Sunday is expected, not an anomaly).
function computeSundayOvertime(punches) {
  const valid = validPunchesForSunday(punches);
  if (valid.length < 2) return null;
  const first = istMinutesOfDay(valid[0].timestamp);
  const last = istMinutesOfDay(valid[valid.length - 1].timestamp);
  const overtimeHours = Math.round(((last - first) / 60) * 2) / 2;
  return { overtimeHours };
}

async function notifyAdmins(type, title, message, employeeId) {
  const admins = await userRepository.findAdmins();
  await notificationService.createForUsers(
    admins.map((a) => a._id),
    { type, title, message, employee: employeeId }
  );
}

// Company holidays are always fully skipped (unchanged). Sundays are NOT an
// "off day" here anymore — see computeSundayOvertime — this now checks
// holidays only.
async function isHolidayLabel(dateLabel) {
  const holidays = await holidayRepository.list({ from: dateLabel, to: dateLabel });
  return holidays.some((h) => dateKey(h.date) === dateKey(dateLabel));
}

// Called fire-and-forget right after a punch is recorded (see
// devicePunch.service.js#recordPunch). Settles yesterday (a new scan today
// proves it's over), then recomputes today from every valid scan so far —
// written as provisional (isSettled: false) since more scans could still
// arrive before the day is actually done.
async function handlePunchEvent(employeeId, timestamp) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) return;

  const dateLabel = istDateLabel(timestamp);

  const stale = await attendanceRepository.findUnsettledBefore(employeeId, dateLabel);
  for (const record of stale) {
    // eslint-disable-next-line no-await-in-loop
    await settleDay(employeeId, record.date);
  }

  if (await isHolidayLabel(dateLabel)) return; // company holidays are never auto-classified

  const existing = await attendanceRepository.findForDate(employeeId, dateLabel);
  if (existing && !existing.isAutoMarked) return; // an admin already decided this day — never touch it

  const { start, end } = istDayBoundsUTC(dateLabel);
  const punches = await devicePunchRepository.listForEmployeeOnDay(employeeId, start, end);

  if (isSunday(dateLabel)) {
    const sundayResult = computeSundayOvertime(punches);
    if (!sundayResult) return; // not enough scans yet — leave it for settlement to decide
    await attendanceRepository.upsertForDate(
      employeeId,
      dateLabel,
      { status: undefined, earlyDeparture: false, overtimeHours: sundayResult.overtimeHours },
      false,
      true,
      undefined,
      false
    );
    return;
  }

  const result = classifyPunches(punches, employee);

  // no-scan/late-absent resolve to Absent immediately, same as a classified
  // day — provisional, since a later scan today can still turn this into a
  // real classification (a stray pre-7am scan alone looks like "no-scan"
  // until a real arrival scan comes in and this gets recomputed).
  if (result.outcome === 'no-scan' || result.outcome === 'late-absent') {
    await attendanceRepository.upsertForDate(
      employeeId,
      dateLabel,
      { status: ATTENDANCE_STATUS.ABSENT, earlyDeparture: false, overtimeHours: 0 },
      false,
      true,
      undefined,
      false
    );
    return;
  }

  if (result.outcome !== 'classified') return; // single-scan/unclassified — not enough info yet, leave for settlement

  await attendanceRepository.upsertForDate(
    employeeId,
    dateLabel,
    { status: result.status, earlyDeparture: result.earlyDeparture, overtimeHours: result.overtimeHours },
    false,
    true,
    undefined,
    false
  );
}

// Finalizes a day: re-derives the result fresh (so it can never disagree
// with what handlePunchEvent would have written) and either confirms the
// classified record as settled, or fires the one-time anomaly notification
// for a day that never resolved to a clean status. Admin-marked days are
// left alone; already-settled days are a no-op (avoids double notifying).
async function settleDay(employeeId, dateLabel) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) return;

  const existing = await attendanceRepository.findForDate(employeeId, dateLabel);
  if (existing && !existing.isAutoMarked) return;
  if (existing && existing.isSettled) return;

  if (await isHolidayLabel(dateLabel)) return;

  const { start, end } = istDayBoundsUTC(dateLabel);
  const punches = await devicePunchRepository.listForEmployeeOnDay(employeeId, start, end);

  if (isSunday(dateLabel)) {
    const sundayResult = computeSundayOvertime(punches);
    if (sundayResult) {
      await attendanceRepository.upsertForDate(
        employeeId,
        dateLabel,
        { status: undefined, earlyDeparture: false, overtimeHours: sundayResult.overtimeHours },
        false,
        true,
        undefined,
        true
      );
    }
    // 0/1 scan on a Sunday is unremarkable — no record, no notification,
    // unlike the weekday no-scan/single-scan anomaly cases below.
    return;
  }

  const result = classifyPunches(punches, employee);
  const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();

  if (result.outcome === 'classified') {
    await attendanceRepository.upsertForDate(
      employeeId,
      dateLabel,
      { status: result.status, earlyDeparture: result.earlyDeparture, overtimeHours: result.overtimeHours },
      false,
      true,
      undefined,
      true
    );
    return;
  }

  // No-scan and first-scan-after-2pm both auto-resolve to a real Absent
  // record rather than being left for manual review — still worth notifying
  // admins so a pattern of absences doesn't go unnoticed.
  if (result.outcome === 'no-scan' || result.outcome === 'late-absent') {
    await attendanceRepository.upsertForDate(
      employeeId,
      dateLabel,
      { status: ATTENDANCE_STATUS.ABSENT, earlyDeparture: false, overtimeHours: 0 },
      false,
      true,
      undefined,
      true
    );
    await notifyAdmins(
      NOTIFICATION_TYPES.ATTENDANCE_NO_SCAN,
      result.outcome === 'no-scan' ? 'No biometric scan today' : 'First scan after 2pm',
      result.outcome === 'no-scan'
        ? `${employeeName} did not scan in at all today — marked as absent.`
        : `${employeeName}'s first scan today was after 2:00pm — marked as absent.`,
      employeeId
    );
    return;
  }

  // single-scan/unclassified are never auto-written as a record — this is
  // what lets the day fall through to payroll's unpaid-absent bucket rather
  // than silently looking "handled," while still flagging it for a human to
  // check rather than guessing. No isSettled marker to flip, so there's a
  // small window for a duplicate notification if this races with the
  // nightly backstop on the exact same day; accepted as harmless.
  if (result.outcome === 'single-scan') {
    await notifyAdmins(
      NOTIFICATION_TYPES.ATTENDANCE_SINGLE_SCAN,
      'Only one scan today',
      `${employeeName} only scanned once today — can't tell arrival from departure. Needs manual review.`,
      employeeId
    );
  } else {
    await notifyAdmins(
      NOTIFICATION_TYPES.ATTENDANCE_UNCLASSIFIED,
      'Unusual scan pattern today',
      `${employeeName}'s scans today don't fit any auto-classification window — left as absent, needs manual review.`,
      employeeId
    );
  }
}

// Nightly backstop (see attendanceClassifier.job.js) — no longer the
// primary classifier, just catches the one thing that can never be
// event-driven (zero scans all day, so no punch ever fired handlePunchEvent)
// and settles any stragglers real-time processing didn't get to (e.g. an
// employee's last working day, with no "tomorrow" scan to trigger
// settlement naturally). Delegates every employee straight to settleDay,
// which already knows how to turn a zero-scan weekday into a settled Absent
// record + notification, and how to stay silent on a quiet Sunday.
async function runNightlyBackstop(dateLabel = todayUTCMidnight()) {
  if (await isHolidayLabel(dateLabel)) {
    logger.info({ date: dateKey(dateLabel) }, 'Attendance backstop: holiday, skipping entirely');
    return { settled: 0 };
  }

  const employees = await employeeRepository.listActive();
  let settled = 0;

  for (const employee of employees) {
    // eslint-disable-next-line no-await-in-loop
    await settleDay(employee._id, dateLabel);
    settled += 1;

    // Catch any older straggler days too (e.g. no scan yesterday or the day
    // before, and nothing since to trigger settlement naturally).
    // eslint-disable-next-line no-await-in-loop
    const stale = await attendanceRepository.findUnsettledBefore(employee._id, dateLabel);
    // eslint-disable-next-line no-await-in-loop
    for (const record of stale) {
      // eslint-disable-next-line no-await-in-loop
      await settleDay(employee._id, record.date);
    }
  }

  logger.info({ date: dateKey(dateLabel), settled }, 'Attendance backstop run complete');
  return { settled };
}

module.exports = { handlePunchEvent, settleDay, runNightlyBackstop, classifyPunches, computeSundayOvertime };
