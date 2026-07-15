const AttendanceRecord = require('../models/AttendanceRecord');

// A plain-object update only $sets keys that are actually present — passing
// `status`/`overtimeHours` as `undefined` when the caller didn't provide them
// leaves whatever was already stored untouched (e.g. setting OT hours on a
// day that already has a status doesn't clear that status, and vice versa).
function upsertForDate(employeeId, date, { status, overtimeHours, notes }, isBackdated) {
  return AttendanceRecord.findOneAndUpdate(
    { employee: employeeId, date },
    { status, overtimeHours, isBackdated, notes },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
  );
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

module.exports = { upsertForDate, listForEmployee, listEmployeeIdsForDate };
