const { dateKey, isOffDay } = require('./attendanceDays');
const holidayRepository = require('../repositories/holiday.repository');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 30; // generous bound — HR is expected to catch up well within a month

function utcMidnight(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// The `count` most recent working days strictly before `from` (default:
// server-today), most recent first — skips Sundays and company holidays,
// same rule as previousWorkingDay below. Backs the daily report's "last 2
// working days" selector, so HR can catch up on the day before yesterday
// without needing an open-ended date picker.
async function recentWorkingDays(count, from = new Date()) {
  const start = utcMidnight(from);
  const lookbackFrom = new Date(start.getTime() - (LOOKBACK_DAYS + count) * MS_PER_DAY);
  const holidays = await holidayRepository.list({ from: lookbackFrom, to: start });
  const holidayDateKeys = new Set(holidays.map((h) => dateKey(h.date)));

  const result = [];
  const cursor = new Date(start.getTime() - MS_PER_DAY);
  const maxIterations = LOOKBACK_DAYS + count;
  for (let i = 0; i < maxIterations && result.length < count; i += 1) {
    if (!isOffDay(cursor, holidayDateKeys)) result.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return result;
}

async function previousWorkingDay(from = new Date()) {
  const [day] = await recentWorkingDays(1, from);
  return day || new Date(utcMidnight(from).getTime() - MS_PER_DAY); // pathological all-holiday stretch — fall back to literal yesterday
}

module.exports = { previousWorkingDay, recentWorkingDays, utcMidnight };
