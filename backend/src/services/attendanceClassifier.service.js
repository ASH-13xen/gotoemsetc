const employeeRepository = require('../repositories/employee.repository');
const devicePunchRepository = require('../repositories/devicePunch.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const holidayRepository = require('../repositories/holiday.repository');
const notificationService = require('./notification.service');
const userRepository = require('../repositories/user.repository');
const { dateKey, isOffDay } = require('../utils/attendanceDays');
const { ATTENDANCE_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
const logger = require('../utils/logger');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Fixed for every employee, regardless of their configured working hours —
// only the grace cutoff (derived from workingHoursStart) and the
// normal/overtime split (derived from workingHoursEnd) move per employee.
const HALF_DAY_ARRIVAL_START = 11 * 60 + 30; // 11:30am
const HALF_DAY_ARRIVAL_END = 13 * 60 + 59; // 1:59pm
const MIDDAY_DEAD_ZONE_START = 14 * 60; // 2:00pm
const MIDDAY_DEAD_ZONE_END = 16 * 60 + 29; // 4:29pm
const EARLY_DEPARTURE_START = 16 * 60 + 30; // 4:30pm
const NIGHT_DEAD_ZONE_END = 6 * 60 + 59; // 6:59am — valid hours resume at 7:00am
const GRACE_MINUTES = 15;

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

// The only two boundaries that move with an employee's configured working
// hours — everything else in this file is a fixed clock time for everyone.
function employeeBoundaries(employee) {
  const shiftStart = parseTimeToMinutes(employee.workingHoursStart);
  const shiftEnd = parseTimeToMinutes(employee.workingHoursEnd);
  return {
    graceCutoff: shiftStart + GRACE_MINUTES,
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
function validPunches(punches) {
  return punches.filter((p) => !isDeadZoneMinute(istMinutesOfDay(p.timestamp)));
}

// The single source of truth for turning a day's punches into a result —
// used both for the real-time provisional write (handlePunchEvent) and the
// final settlement determination (settleDay), so they can never disagree.
//
// Returns one of:
//   { outcome: 'no-scan' }
//   { outcome: 'single-scan' }
//   { outcome: 'unclassified' }          — 2+ valid scans, but arrival or
//                                           departure falls outside every
//                                           window this employee has
//   { outcome: 'classified', status, earlyDeparture, overtimeHours }
function classifyPunches(punches, employee) {
  const valid = validPunches(punches);
  if (valid.length === 0) return { outcome: 'no-scan' };
  if (valid.length === 1) return { outcome: 'single-scan' };

  const { graceCutoff, shiftEnd, normalEnd } = employeeBoundaries(employee);
  const arrivalMinutes = istMinutesOfDay(valid[0].timestamp);
  const departureMinutes = istMinutesOfDay(valid[valid.length - 1].timestamp);

  let status;
  if (arrivalMinutes <= graceCutoff) status = ATTENDANCE_STATUS.PRESENT;
  else if (arrivalMinutes < HALF_DAY_ARRIVAL_START) status = ATTENDANCE_STATUS.SHORT_LEAVE;
  else if (arrivalMinutes <= HALF_DAY_ARRIVAL_END) status = ATTENDANCE_STATUS.HALF_DAY;
  else status = null; // arrival landed at/after the midday dead zone with no earlier valid scan

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

  if (!status || !departureOk) return { outcome: 'unclassified' };
  return { outcome: 'classified', status, earlyDeparture, overtimeHours };
}

async function notifyAdmins(type, title, message, employeeId) {
  const admins = await userRepository.findAdmins();
  await notificationService.createForUsers(
    admins.map((a) => a._id),
    { type, title, message, employee: employeeId }
  );
}

async function isOffDayLabel(dateLabel) {
  const holidays = await holidayRepository.list({ from: dateLabel, to: dateLabel });
  const holidayDateKeys = new Set(holidays.map((h) => dateKey(h.date)));
  return isOffDay(dateLabel, holidayDateKeys);
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

  if (await isOffDayLabel(dateLabel)) return; // Sundays/holidays are never auto-classified

  const existing = await attendanceRepository.findForDate(employeeId, dateLabel);
  if (existing && !existing.isAutoMarked) return; // an admin already decided this day — never touch it

  const { start, end } = istDayBoundsUTC(dateLabel);
  const punches = await devicePunchRepository.listForEmployeeOnDay(employeeId, start, end);
  const result = classifyPunches(punches, employee);

  if (result.outcome !== 'classified') return; // not enough info yet — leave it for settlement to decide

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

  if (await isOffDayLabel(dateLabel)) return;

  const { start, end } = istDayBoundsUTC(dateLabel);
  const punches = await devicePunchRepository.listForEmployeeOnDay(employeeId, start, end);
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

  // Anomalies are never written as a record — same as before, this is what
  // lets the day fall through to payroll's unpaid-absent bucket rather than
  // silently looking "handled." No isSettled marker to flip, so there's a
  // small window for a duplicate notification if this races with the
  // nightly backstop on the exact same day; accepted as harmless.
  if (result.outcome === 'no-scan') {
    await notifyAdmins(
      NOTIFICATION_TYPES.ATTENDANCE_NO_SCAN,
      'No biometric scan today',
      `${employeeName} has not scanned in at all today.`,
      employeeId
    );
  } else if (result.outcome === 'single-scan') {
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
// event-driven (zero scans all day) and settles any stragglers real-time
// processing didn't get to (e.g. an employee's last working day, with no
// "tomorrow" scan to trigger settlement naturally).
async function runNightlyBackstop(dateLabel = todayUTCMidnight()) {
  if (await isOffDayLabel(dateLabel)) {
    logger.info({ date: dateKey(dateLabel) }, 'Attendance backstop: off day, skipping entirely');
    return { settled: 0, noScan: 0 };
  }

  const employees = await employeeRepository.listActive();
  const { start, end } = istDayBoundsUTC(dateLabel);

  let settled = 0;
  let noScan = 0;

  for (const employee of employees) {
    // eslint-disable-next-line no-await-in-loop
    const punches = await devicePunchRepository.listForEmployeeOnDay(employee._id, start, end);
    if (punches.length === 0) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await attendanceRepository.findForDate(employee._id, dateLabel);
      if (!existing) {
        const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
        // eslint-disable-next-line no-await-in-loop
        await notifyAdmins(
          NOTIFICATION_TYPES.ATTENDANCE_NO_SCAN,
          'No biometric scan today',
          `${employeeName} has not scanned in at all today.`,
          employee._id
        );
        noScan += 1;
      }
    } else {
      // eslint-disable-next-line no-await-in-loop
      await settleDay(employee._id, dateLabel);
      settled += 1;
    }

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

  logger.info({ date: dateKey(dateLabel), settled, noScan }, 'Attendance backstop run complete');
  return { settled, noScan };
}

module.exports = { handlePunchEvent, settleDay, runNightlyBackstop, classifyPunches };
