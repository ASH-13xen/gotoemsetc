const ApiError = require('../utils/ApiError');
const holidayRepository = require('../repositories/holiday.repository');
const attendanceClassifierService = require('./attendanceClassifier.service');

// Kept consistent with the same UTC-midnight "today" used for the attendance
// backdating cutoffs (attendance.service.js, attendanceRequest.service.js) —
// holiday dates are plain 'YYYY-MM-DD' strings, which parse as UTC midnight
// too, so the comparison never drifts by a day.
function todayUTCMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function listHolidays({ month, year }) {
  const now = new Date();
  const y = year || now.getUTCFullYear();
  const m = month ? month - 1 : now.getUTCMonth();

  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 0));

  return holidayRepository.list({ from, to });
}

async function createHoliday({ date, label, type = 'holiday' }, createdBy) {
  const normalized = new Date(date);
  if (Number.isNaN(normalized.getTime())) throw ApiError.badRequest('Invalid date');
  if (normalized.getTime() < todayUTCMidnight().getTime()) {
    throw ApiError.badRequest('Cannot mark a past date as a holiday');
  }

  let holiday;
  try {
    holiday = await holidayRepository.create({ date: normalized, label, type, createdBy });
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('This date is already marked');
    throw err;
  }

  // Instantly applies to every active employee — see
  // attendanceClassifier.service.js#applyHolidayToAllEmployees/
  // applyHalfDayToAllEmployees/applySlDayToAllEmployees — rather than
  // waiting for each of them to scan in/out before it shows up.
  if (type === 'half_day') {
    await attendanceClassifierService.applyHalfDayToAllEmployees(normalized);
  } else if (type === 'sl_day') {
    await attendanceClassifierService.applySlDayToAllEmployees(normalized);
  } else {
    await attendanceClassifierService.applyHolidayToAllEmployees(normalized);
  }
  return holiday;
}

async function removeHoliday(id) {
  const holiday = await holidayRepository.removeById(id);
  if (!holiday) throw ApiError.notFound('Holiday not found');
  if (holiday.type === 'half_day') {
    await attendanceClassifierService.revertHalfDayForAllEmployees(holiday.date);
  } else if (holiday.type === 'sl_day') {
    await attendanceClassifierService.revertSlDayForAllEmployees(holiday.date);
  } else {
    await attendanceClassifierService.revertHolidayForAllEmployees(holiday.date);
  }
  return holiday;
}

module.exports = { listHolidays, createHoliday, removeHoliday };
