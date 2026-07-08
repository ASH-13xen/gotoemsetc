const ApiError = require('../utils/ApiError');
const holidayRepository = require('../repositories/holiday.repository');

async function listHolidays({ month, year }) {
  const now = new Date();
  const y = year || now.getUTCFullYear();
  const m = month ? month - 1 : now.getUTCMonth();

  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 0));

  return holidayRepository.list({ from, to });
}

async function createHoliday({ date, label }, createdBy) {
  const normalized = new Date(date);
  if (Number.isNaN(normalized.getTime())) throw ApiError.badRequest('Invalid date');

  try {
    return await holidayRepository.create({ date: normalized, label, createdBy });
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('This date is already marked as a holiday');
    throw err;
  }
}

async function removeHoliday(id) {
  const holiday = await holidayRepository.removeById(id);
  if (!holiday) throw ApiError.notFound('Holiday not found');
  return holiday;
}

module.exports = { listHolidays, createHoliday, removeHoliday };
