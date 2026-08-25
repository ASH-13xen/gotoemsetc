// The Client Management System's calendar is a *civil* calendar — a cell is
// "5 August in India", not an instant. The server runs UTC, so building dates
// with `new Date(y, m, d, h)` would silently shift every deadline by 5.5
// hours (09:30 becomes 15:00 IST). Everything here constructs the UTC instant
// that corresponds to a given IST wall-clock time, explicitly.
//
// India has a single, fixed offset and no daylight saving, so a constant is
// correct and a tz database is unnecessary.
const IST_OFFSET_MINUTES = 330; // UTC+05:30
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

// Wall-clock times the calendar pins tasks to, per the product spec: work
// opens at 09:30 IST and is due at 18:30 IST.
const WORKDAY_START = { hour: 9, minute: 30 };
const WORKDAY_END = { hour: 18, minute: 30 };

// The UTC instant of a given IST wall-clock time. Month is 1-based, matching
// how the calendar API and UI talk about months (and unlike Date's 0-based
// getMonth, which is exactly the bug this module exists to prevent).
function istInstant(year, month, day, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS);
}

// The IST civil date-parts of an instant. Shift into IST, then read the UTC
// parts of the shifted value — reading local parts would reintroduce the
// server's own timezone.
function istParts(date) {
  const shifted = new Date(new Date(date).getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(), // 0 = Sunday
  };
}

// 00:00 IST on the day the given instant falls in.
function istDayStart(date) {
  const { year, month, day } = istParts(date);
  return istInstant(year, month, day);
}

// A specific IST wall-clock time on the day the given instant falls in.
function istAt(date, hour, minute) {
  const { year, month, day } = istParts(date);
  return istInstant(year, month, day, hour, minute);
}

function istWorkdayStart(date) {
  return istAt(date, WORKDAY_START.hour, WORKDAY_START.minute);
}

function istWorkdayEnd(date) {
  return istAt(date, WORKDAY_END.hour, WORKDAY_END.minute);
}

// Half-open [start, end) covering an entire IST month — the range every
// calendar query filters on. End is 00:00 IST on the 1st of the next month,
// so an item scheduled at 18:30 IST on the 31st is included and one at 00:00
// IST on the 1st of the next month is not.
function istMonthRange(year, month) {
  const start = istInstant(year, month, 1);
  const end = month === 12 ? istInstant(year + 1, 1, 1) : istInstant(year, month + 1, 1);
  return { start, end };
}

function istDaysInMonth(year, month) {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Does an instant fall inside the given IST month?
function isInIstMonth(date, year, month) {
  const parts = istParts(date);
  return parts.year === year && parts.month === month;
}

// Do two instants fall on the same IST civil day?
function isSameIstDay(a, b) {
  const pa = istParts(a);
  const pb = istParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

// "2026-08-05" for the IST day an instant falls in — the stable key the
// calendar UI groups items by. Deliberately not toISOString(), which would
// give the UTC day and land evening items on the previous date.
function istDateKey(date) {
  const { year, month, day } = istParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

module.exports = {
  IST_OFFSET_MINUTES,
  WORKDAY_START,
  WORKDAY_END,
  istInstant,
  istParts,
  istDayStart,
  istAt,
  istWorkdayStart,
  istWorkdayEnd,
  istMonthRange,
  istDaysInMonth,
  isInIstMonth,
  isSameIstDay,
  istDateKey,
};
