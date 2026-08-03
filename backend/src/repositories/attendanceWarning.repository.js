const AttendanceWarning = require('../models/AttendanceWarning');

function create(data) {
  return AttendanceWarning.create(data);
}

// Every warning already sent for a given date, across all employees — used
// to mark daily-report rows as "already warned" instead of re-offering the
// checkbox for an occurrence that's already been acted on.
function findForDate(date) {
  return AttendanceWarning.find({ date }).populate('sentBy', 'username');
}

function countForEmployeeCategoryInRange(employee, category, from, to) {
  return AttendanceWarning.countDocuments({ employee, category, date: { $gte: from, $lte: to } });
}

// Full monthly breakdown for the Employee Detail page — every category's
// count plus the raw history, computed together in one pass over the
// month's warnings rather than 5 separate countDocuments calls.
async function listForEmployeeInRange(employee, from, to) {
  return AttendanceWarning.find({ employee, date: { $gte: from, $lte: to } })
    .populate('sentBy', 'username')
    .sort({ date: 1 });
}

module.exports = { create, findForDate, countForEmployeeCategoryInRange, listForEmployeeInRange };
