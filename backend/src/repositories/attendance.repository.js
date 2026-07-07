const AttendanceRecord = require('../models/AttendanceRecord');

function upsertForDate(employeeId, date, status, isBackdated, notes) {
  return AttendanceRecord.findOneAndUpdate(
    { employee: employeeId, date },
    { status, isBackdated, notes },
    { upsert: true, returnDocument: 'after', runValidators: true }
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

module.exports = { upsertForDate, listForEmployee };
