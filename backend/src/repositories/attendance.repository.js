const AttendanceRecord = require('../models/AttendanceRecord');

// A plain-object update only $sets keys that are actually present — passing
// `status`/`overtimeHours` as `undefined` when the caller didn't provide them
// leaves whatever was already stored untouched (e.g. setting OT hours on a
// day that already has a status doesn't clear that status, and vice versa).
// `isAutoMarked` is always written explicitly (never left undefined) — a
// manual admin save must always flip an existing auto-mark back to false,
// and the classifier must always set it true, so neither path can rely on
// "leave untouched" here.
function upsertForDate(
  employeeId,
  date,
  { status, overtimeHours, notes, isLate },
  isBackdated,
  isAutoMarked = false,
  modifiedByRequest
) {
  const update = { status, overtimeHours, isBackdated, notes, isAutoMarked, isLate };
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

module.exports = { upsertForDate, findForDate, listForEmployee, listEmployeeIdsForDate };
