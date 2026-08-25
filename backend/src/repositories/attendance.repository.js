const AttendanceRecord = require('../models/AttendanceRecord');

// A plain-object update only $sets keys that are actually present — passing
// `status`/`overtimeMinutes` as `undefined` when the caller didn't provide them
// leaves whatever was already stored untouched (e.g. setting OT minutes on a
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
  { status, overtimeMinutes, notes, isLate, earlyDeparture, isHalfDayBoost },
  isBackdated,
  isAutoMarked = false,
  modifiedByRequest,
  isSettled = true
) {
  const update = {
    status,
    overtimeMinutes,
    isBackdated,
    notes,
    isAutoMarked,
    isLate,
    earlyDeparture,
    isSettled,
    isHalfDayBoost,
  };
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

// Restores a date's AttendanceRecord to exactly how it looked before a
// modification-request resolution overwrote it — or, if `snapshot` is null
// (no record existed at that point), brings it back to that same blank
// shell. Used only by attendanceRequest.service.js#revokeRequest. Never
// deletes the document: status/notes are $unset rather than the record
// being removed, so the row (and its _id/history) survives even a full
// revert-to-nothing, consistent with never destroying existing data.
function applySnapshot(employeeId, date, snapshot) {
  const target = snapshot || {};
  const set = {
    overtimeMinutes: target.overtimeMinutes || 0,
    isLate: Boolean(target.isLate),
    earlyDeparture: Boolean(target.earlyDeparture),
    modifiedByRequest: false,
  };
  const unset = {};
  if (target.status) set.status = target.status;
  else unset.status = '';
  if (target.notes) set.notes = target.notes;
  else unset.notes = '';
  if (!snapshot) {
    set.isAutoMarked = false;
    set.isSettled = true;
  }
  const update = { $set: set };
  if (Object.keys(unset).length > 0) update.$unset = unset;
  return AttendanceRecord.findOneAndUpdate({ employee: employeeId, date }, update, { new: true });
}

// Used only to undo an auto-written Holiday record when the holiday itself
// is removed (see attendanceClassifier.service.js#revertHolidayForAllEmployees)
// — never called on a manually-set record.
function deleteForDate(employeeId, date) {
  return AttendanceRecord.deleteOne({ employee: employeeId, date });
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

// Every employee's record for one exact date — backs the daily attendance
// report (attendanceWarning.service.js#computeDailyReport). isDeleted
// employees are filtered out by the caller after populate, same reasoning
// as employee.repository.js's other list queries.
function listForDate(date) {
  return AttendanceRecord.find({ date }).populate('employee', 'firstName lastName employeeCode designation isDeleted status');
}

// Every employee's records across a date range — backs HR Work's org-wide
// "All merged attendance" monthly overview (frontendhr). isDeleted employees
// are filtered out by the caller after populate, same reasoning as
// listForDate.
function listAllForRange(from, to) {
  return AttendanceRecord.find({ date: { $gte: from, $lte: to } })
    .populate('employee', 'firstName lastName employeeCode designation isDeleted')
    .sort({ date: 1 });
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

module.exports = {
  upsertForDate,
  findForDate,
  applySnapshot,
  listForDate,
  listAllForRange,
  deleteForDate,
  findUnsettledBefore,
  listForEmployee,
  listEmployeeIdsForDate,
};
