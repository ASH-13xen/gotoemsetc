const { PROBATION_MONTHS } = require('../config/constants');

function startOfUTCDate(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Calendar months after `date`, keeping the day (clamped to the target
// month's length — 31 Jan + 1 month = 28/29 Feb).
function addMonths(date, months) {
  const d = startOfUTCDate(date);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d.getUTCDate(), lastDay)));
}

// The first day the employee is no longer on probation: PROBATION_MONTHS
// after joining, or earlier if HR ticked "Probation completed" (from the
// day it was ticked). Null when there's nothing to go on — no joining date
// and never ticked.
function probationEndDate(employee) {
  const automatic = employee?.dateOfJoining ? addMonths(employee.dateOfJoining, PROBATION_MONTHS) : null;
  const early = employee?.probationCompleted && employee.probationCompletedAt ? startOfUTCDate(employee.probationCompletedAt) : null;
  if (automatic && early) return early < automatic ? early : automatic;
  if (automatic || early) return automatic || early;
  // A legacy record with no joining date that HR has marked as done.
  return employee?.probationCompleted ? new Date(0) : null;
}

// Was the employee past probation on `date`?
function isPastProbation(employee, date) {
  const end = probationEndDate(employee);
  return Boolean(end) && startOfUTCDate(date).getTime() >= end.getTime();
}

module.exports = { probationEndDate, isPastProbation, addMonths };
