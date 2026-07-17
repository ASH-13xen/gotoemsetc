const AttendanceRecord = require('../models/AttendanceRecord');

// A plain-object update only $sets keys that are actually present — passing
// `status`/`overtimeHours` as `undefined` when the caller didn't provide them
// leaves whatever was already stored untouched (e.g. setting OT hours on a
// day that already has a status doesn't clear that status, and vice versa).
// `isAutoMarked` is always written explicitly (never left undefined) — a
// manual admin save must always flip an existing auto-mark back to false,
// and the classifier must always set it true, so neither path can rely on
// "leave untouched" here.
// `isSettled` defaults true — every caller except the real-time classifier's
// provisional writes is making a final decision (a manual admin mark, or a
// request-resolve) the instant it's saved. The classifier explicitly passes
// false while a day could still be revised by a later scan the same day.
function upsertForDate(
  employeeId,
  date,
  { status, overtimeHours, notes, isLate, earlyDeparture },
  isBackdated,
  isAutoMarked = false,
  modifiedByRequest,
  isSettled = true
) {
  const update = { status, overtimeHours, isBackdated, notes, isAutoMarked, isLate, earlyDeparture, isSettled };
  if (modifiedByRequest !== undefined) update.modifiedByRequest = modifiedByRequest;
  return AttendanceRecord.findOneAndUpdate(
    { employee: employeeId, date },
    update,
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
  );
}

// Only what the classifier needs to decide whether a day is safe to
// (re)write — never touches days a human already decided on.
function findForDate(employeeId, date) {
  return AttendanceRecord.findOne({ employee: employeeId, date });
}

// Every auto-marked, not-yet-settled record for this employee strictly
// before `beforeDate` — used to settle "yesterday" (or older stragglers)
// the moment a new scan proves that day is over.
function findUnsettledBefore(employeeId, beforeDate) {
  return AttendanceRecord.find({
    employee: employeeId,
    date: { $lt: beforeDate },
    isAutoMarked: true,
    isSettled: false,
  });
}

function listForEmployee(employeeId, { from, to } = {}) {
  const query = { employee: employeeId };
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = from;
    if (to) query.date.$lte = to;
  }
  return AttendanceRecord.find(query).sort({ date: 1 });
}

// Which employees already have a record for this exact date — a record
// with no status (overtime-only) still counts as "marked" for this
// purpose, same as any other record.
async function listEmployeeIdsForDate(date) {
  const records = await AttendanceRecord.find({ date }).select('employee');
  return records.map((r) => r.employee.toString());
}

module.exports = { upsertForDate, findForDate, findUnsettledBefore, listForEmployee, listEmployeeIdsForDate };
