function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function isSunday(date) {
  return date.getUTCDay() === 0;
}

// `holidayDateKeys` is a Set of dateKey() strings for company holidays in
// the range being scanned — built once by the caller rather than queried
// per-day.
function isOffDay(date, holidayDateKeys) {
  return isSunday(date) || holidayDateKeys.has(dateKey(date));
}

module.exports = { dateKey, isSunday, isOffDay };
