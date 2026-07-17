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
const SHIFT_START_MINUTES = 9 * 60 + 30; // 9:30 AM
const SHIFT_END_MINUTES = 18 * 60 + 30; // 6:30 PM
const GRACE_MINUTES = 30;
const HALF_DAY_THRESHOLD_HOURS = 4.5;

function todayUTCMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// `dateLabel` is the UTC-midnight day marker used everywhere else in the
// attendance system (see AttendanceRecord.date) — but punches are real UTC
// instants, so classifying "arrived by 9:30am IST" needs the actual IST
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
function classifyFromPunches(punches) {
  const arrival = punches[0].timestamp;
  const departure = punches[punches.length - 1].timestamp;
  const hoursWorked = (departure.getTime() - arrival.getTime()) / (1000 * 60 * 60);

  if (hoursWorked < HALF_DAY_THRESHOLD_HOURS) return ATTENDANCE_STATUS.HALF_DAY;

  const arrivalMinutes = istMinutesOfDay(arrival);
  const departureMinutes = istMinutesOfDay(departure);
  const isLate = arrivalMinutes > SHIFT_START_MINUTES + GRACE_MINUTES;
  const leftEarly = departureMinutes < SHIFT_END_MINUTES;

  if (leftEarly) return ATTENDANCE_STATUS.SHORT_LEAVE;
  if (isLate) return ATTENDANCE_STATUS.LATE;
  return ATTENDANCE_STATUS.PRESENT;
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

    const status = classifyFromPunches(punches);
    // eslint-disable-next-line no-await-in-loop
    await attendanceRepository.upsertForDate(employee._id, dateLabel, { status }, false, true);
    classified += 1;
  }

  logger.info({ date: dateKey(dateLabel), classified, skipped, flagged }, 'Attendance classifier run complete');
  return { classified, skipped, flagged };
}

module.exports = { classifyDay, classifyFromPunches };
