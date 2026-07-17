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

// Grace period: 15 minutes past the 9:30am shift start.
const SHIFT_START_MINUTES = 9 * 60 + 30; // 9:30am
const GRACE_MINUTES = 15;
const LATE_CUTOFF_MINUTES = SHIFT_START_MINUTES + GRACE_MINUTES; // 9:45am

const SHORT_LEAVE_ARRIVAL_START = 10 * 60; // 10:00am
const HALF_DAY_ARRIVAL_START = 11 * 60 + 30; // 11:30am
const HALF_DAY_ARRIVAL_END = 14 * 60; // 2:00pm — arriving after this is too late to auto-classify at all

const NORMAL_EXIT_MINUTES = 18 * 60 + 30; // 6:30pm — the official shift end
const OVERTIME_START_MINUTES = 19 * 60 + 30; // 7:30pm — earliest a departure counts as overtime
const EARLY_DEPARTURE_START = 16 * 60 + 30; // 4:30pm — leaving on/after this but before 6:30pm is a short leave regardless of arrival

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

// First scan of the day = arrival, last = departure — anything in between
// (lunch, re-entries) is ignored, per the rules agreed with the user.
//
// `status` is the headline classification (or null if the day is too
// irregular to auto-classify — see classifyDay, which leaves no
// AttendanceRecord in that case so it falls into payroll's unpaid-absent
// bucket). `isLate` and `overtimeHours` are independent of status and of
// each other — a day can be a Short Leave AND late AND have logged
// overtime all at once.
function classifyFromPunches(punches) {
  const arrival = punches[0].timestamp;
  const departure = punches[punches.length - 1].timestamp;
  const arrivalMinutes = istMinutesOfDay(arrival);
  const departureMinutes = istMinutesOfDay(departure);

  const isLate = arrivalMinutes > LATE_CUTOFF_MINUTES;

  let overtimeHours = 0;
  if (departureMinutes >= OVERTIME_START_MINUTES) {
    overtimeHours = Math.round(((departureMinutes - NORMAL_EXIT_MINUTES) / 60) * 2) / 2;
  }

  // Left on/after 4:30pm but before the official 6:30pm end — short leave,
  // independent of how on-time the arrival was (can still stack with isLate).
  if (departureMinutes >= EARLY_DEPARTURE_START && departureMinutes < NORMAL_EXIT_MINUTES) {
    return { status: ATTENDANCE_STATUS.SHORT_LEAVE, isLate, overtimeHours: 0 };
  }

  // Left before 4:30pm entirely, or arrived after 2pm — too irregular for
  // any of the recognized windows, left unclassified for manual review.
  if (departureMinutes < NORMAL_EXIT_MINUTES || arrivalMinutes > HALF_DAY_ARRIVAL_END) {
    return { status: null, isLate: false, overtimeHours: 0 };
  }

  if (arrivalMinutes >= HALF_DAY_ARRIVAL_START) {
    return { status: ATTENDANCE_STATUS.HALF_DAY, isLate, overtimeHours };
  }
  if (arrivalMinutes >= SHORT_LEAVE_ARRIVAL_START) {
    return { status: ATTENDANCE_STATUS.SHORT_LEAVE, isLate, overtimeHours };
  }
  return { status: ATTENDANCE_STATUS.PRESENT, isLate, overtimeHours };
}

async function notifyAdmins(type, title, message, employeeId) {
  const admins = await userRepository.findAdmins();
  await notificationService.createForUsers(
    admins.map((a) => a._id),
    { type, title, message, employee: employeeId }
  );
}

// Runs once daily (see attendanceClassifier.job.js). Writes an
// AttendanceRecord per employee for `dateLabel` based on that day's
// DevicePunch scans — but only for days nobody has already decided on by
// hand (see the isAutoMarked guard on AttendanceRecord).
async function classifyDay(dateLabel = todayUTCMidnight()) {
  const holidays = await holidayRepository.list({ from: dateLabel, to: dateLabel });
  const holidayDateKeys = new Set(holidays.map((h) => dateKey(h.date)));
  if (isOffDay(dateLabel, holidayDateKeys)) {
    logger.info({ date: dateKey(dateLabel) }, 'Attendance classifier: off day, skipping entirely');
    return { classified: 0, skipped: 0, flagged: 0 };
  }

  const employees = await employeeRepository.listActive();
  const { start, end } = istDayBoundsUTC(dateLabel);

  let classified = 0;
  let skipped = 0;
  let flagged = 0;

  for (const employee of employees) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await attendanceRepository.findForDate(employee._id, dateLabel);
    if (existing && !existing.isAutoMarked) {
      skipped += 1;
      continue; // an admin already decided this day — never touch it
    }

    const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
    // eslint-disable-next-line no-await-in-loop
    const punches = await devicePunchRepository.listForEmployeeOnDay(employee._id, start, end);

    if (punches.length === 0) {
      // eslint-disable-next-line no-await-in-loop
      await notifyAdmins(
        NOTIFICATION_TYPES.ATTENDANCE_NO_SCAN,
        'No biometric scan today',
        `${employeeName} has not scanned in at all today.`,
        employee._id
      );
      flagged += 1;
      continue;
    }

    if (punches.length === 1) {
      // eslint-disable-next-line no-await-in-loop
      await notifyAdmins(
        NOTIFICATION_TYPES.ATTENDANCE_SINGLE_SCAN,
        'Only one scan today',
        `${employeeName} only scanned once today — can't tell arrival from departure. Needs manual review.`,
        employee._id
      );
      flagged += 1;
      continue;
    }

    const { status, isLate, overtimeHours } = classifyFromPunches(punches);

    if (!status) {
      // eslint-disable-next-line no-await-in-loop
      await notifyAdmins(
        NOTIFICATION_TYPES.ATTENDANCE_UNCLASSIFIED,
        'Unusual scan pattern today',
        `${employeeName}'s scans today don't fit any auto-classification window — left as absent, needs manual review.`,
        employee._id
      );
      flagged += 1;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await attendanceRepository.upsertForDate(employee._id, dateLabel, { status, isLate, overtimeHours }, false, true);
    classified += 1;
  }

  logger.info({ date: dateKey(dateLabel), classified, skipped, flagged }, 'Attendance classifier run complete');
  return { classified, skipped, flagged };
}

module.exports = { classifyDay, classifyFromPunches };
