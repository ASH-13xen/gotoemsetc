const { numberToIndianWords } = require('./mergeData.service');
const attendanceRepository = require('../repositories/attendance.repository');
const holidayRepository = require('../repositories/holiday.repository');
const { ATTENDANCE_STATUS } = require('../config/constants');
const { dateKey, isOffDay } = require('../utils/attendanceDays');
const { computeEffectiveUnitsBreakdown } = require('../utils/attendancePenalties');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// The daily-rate denominator: the SMALLEST calendar month touched by the
// period, not the period's own length. E.g. 15 June - 19 July divides by
// min(30 days in June, 31 in July) = 30, not by the 35 days actually
// spanned — this keeps the daily rate anchored to "a normal month" the way
// a single full-month slip always was, rather than shrinking/inflating it
// based on how long a custom range happens to be. For a range within one
// calendar month this is just that month's day count, matching the
// original single-month behavior exactly.
function minDaysAcrossTouchedMonths(startDate, endDate) {
  let year = startDate.getUTCFullYear();
  let month = startDate.getUTCMonth();
  const endYear = endDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();

  let min = Infinity;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    min = Math.min(min, daysInMonth(year, month));
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return min;
}

// Attendance is stored one record per calendar day, so any admin-picked
// [startDate, endDate] range (inclusive, both UTC midnight) can be
// summarized directly — nothing here is anchored to a calendar month.
async function computeAttendanceSummary(employeeId, startDate, endDate) {
  const [records, holidays] = await Promise.all([
    attendanceRepository.listForEmployee(employeeId, { from: startDate, to: endDate }),
    holidayRepository.list({ from: startDate, to: endDate }),
  ]);

  const totalDaysInPeriod = Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
  const holidayDateKeys = new Set(holidays.map((h) => dateKey(h.date)));
  const recordByDate = new Map(records.map((r) => [dateKey(r.date), r]));

  const counts = { P: 0, O: 0, H: 0, L: 0, SL: 0, W: 0, A: 0, HL: 0 };
  let totalOvertimeMinutes = 0;
  // isLate is independent of status (see attendanceClassifier.service.js) —
  // a day can be e.g. Short Leave AND late at once, so it's tallied
  // separately here rather than folded into counts.L (which stays exactly
  // what it always was: days whose *status* is literally 'L').
  let lateFlagCount = 0;
  // earlyDeparture is likewise independent of status — a day can be a
  // Short Leave arrival AND an early departure at once (two short leaves in
  // one day), so it's a separate tally feeding the same penalty pool below.
  let earlyDepartureCount = 0;
  // Parallel date-tagged lists, alongside the plain counts above — this is
  // what lets the generated salary slip show an employee exactly which
  // dates produced a Late/Short-Leave/Half-Day deduction, not just a final
  // number. See attendancePenalties.js#computeEffectiveUnitsBreakdown.
  const lateStatusDates = [];
  const lateFlagDates = [];
  const slStatusDates = [];
  const earlyDepartureDates = [];
  const halfDayStatusDates = [];
  for (const record of records) {
    if (record.status) {
      counts[record.status] += 1;
      if (record.status === ATTENDANCE_STATUS.LATE) lateStatusDates.push(record.date);
      if (record.status === ATTENDANCE_STATUS.SHORT_LEAVE) slStatusDates.push(record.date);
      if (record.status === ATTENDANCE_STATUS.HALF_DAY) halfDayStatusDates.push(record.date);
    }
    if (record.isLate) {
      lateFlagCount += 1;
      lateFlagDates.push(record.date);
    }
    if (record.earlyDeparture) {
      earlyDepartureCount += 1;
      earlyDepartureDates.push(record.date);
    }
    totalOvertimeMinutes += record.overtimeMinutes || 0;
  }

  let offDaysInPeriod = 0;
  let unpaidAbsentDays = 0;
  for (let i = 0; i < totalDaysInPeriod; i += 1) {
    const date = new Date(startDate.getTime() + i * MS_PER_DAY);
    const off = isOffDay(date, holidayDateKeys);
    if (off) {
      offDaysInPeriod += 1;
      continue;
    }
    // A day with no record at all (never marked) and a day auto-marked
    // Absent (see attendanceClassifier.service.js) both cost a full day's
    // pay — Absent still has a record, so it wouldn't otherwise be caught
    // by the "no record" check alone.
    const record = recordByDate.get(dateKey(date));
    if (!record || record.status === ATTENDANCE_STATUS.ABSENT) unpaidAbsentDays += 1;
  }

  const workingDaysInPeriod = totalDaysInPeriod - offDaysInPeriod;

  // At most 2 Lates and 2 Short-Leave units count in full; the overflow
  // demotes down to Half-Day units (see attendancePenalties.js) — computed
  // date-by-date so the exact dates behind each number can be shown on the
  // generated salary slip, not just the totals.
  const deductionBreakdown = computeEffectiveUnitsBreakdown({
    lateStatusDates,
    lateFlagDates,
    slStatusDates,
    earlyDepartureDates,
    halfDayStatusDates,
  });
  const { lateToSLUnits, effectiveSLUnits, cappedLateUnits, cappedSLUnits, halfDayPenaltyUnits } = deductionBreakdown;

  // Actual Half-Day-status days plus every day demoted down to Half-Day by
  // the cap above — one unified pool for both Days Worked credit and the
  // Half Day Deductions line. Same count as deductionBreakdown.halfDayEvents.length.
  const totalHalfDayUnits = counts.H + halfDayPenaltyUnits;

  const daysWorkedTotal =
    counts.P + counts.O + counts.W + cappedLateUnits + cappedSLUnits + totalHalfDayUnits * 0.5;

  return {
    totalDaysInPeriod,
    dailyRateDivisor: minDaysAcrossTouchedMonths(startDate, endDate),
    workingDaysInPeriod,
    counts,
    daysWorkedTotal,
    lateFlagCount,
    earlyDepartureCount,
    lateToSLUnits,
    effectiveSLUnits,
    cappedLateUnits,
    cappedSLUnits,
    halfDayPenaltyUnits,
    totalHalfDayUnits,
    deductionBreakdown,
    unpaidAbsentDays,
    totalOvertimeMinutes,
    records,
    holidays,
  };
}

function computeSalary(employee, summary, manualInputs) {
  const {
    incomeTaxDeduction = 0,
    professionTax = 0,
    pf = 0,
    otherDeduction3 = 0,
    compensationOff = 0,
    incentives = 0,
    travelAllowance = 0,
    otherEarning1 = 0,
    reimbursement1 = 0,
    reimbursement2 = 0,
  } = manualInputs;

  const basicMaster = employee.monthlyPay || (employee.ctcAnnual ? employee.ctcAnnual / 12 : 0) || 0;
  // See minDaysAcrossTouchedMonths — the smallest calendar month touched by
  // the period, not the period's own length.
  const dailyRate = summary.dailyRateDivisor > 0 ? basicMaster / summary.dailyRateDivisor : 0;

  // Per-minute rate = the daily rate (basicMaster / days in the month) / 9
  // hours / 60. Overtime is purely minutes actually worked × that rate — no
  // baseline amount shows up when totalOvertimeMinutes is 0. Like every
  // Earnings row except Basic, Master and Earnings carry the same value here.
  const otMinuteRate = dailyRate / 9 / 60;
  const otEarnings = otMinuteRate * summary.totalOvertimeMinutes;
  const otMaster = otEarnings;

  const halfDayDeductions = summary.totalHalfDayUnits * (dailyRate / 2);
  const unpaidOffDeductions = summary.unpaidAbsentDays * dailyRate;
  const totalDeductions =
    incomeTaxDeduction + professionTax + pf + halfDayDeductions + unpaidOffDeductions + otherDeduction3;

  // Master = the employee's flat monthly reference rate, shown as-is.
  // Earnings = what was actually earned this specific period — prorated by
  // the daily rate × the number of days the period actually covers. For a
  // full calendar month these are identical (totalDaysInPeriod ===
  // dailyRateDivisor), which is why this was previously indistinguishable
  // from just cloning basicMaster — but for any partial period (a new
  // joiner's first, clipped month; an admin-picked custom range shorter
  // than a month) Earnings must scale down, or the employee gets paid a
  // full month's Basic for only part of it.
  const basicEarnings = dailyRate * summary.totalDaysInPeriod;
  const grossEarnings = basicEarnings + otMaster + compensationOff + incentives + travelAllowance + otherEarning1;

  const totalReimbursements = reimbursement1 + reimbursement2;
  const netPayable = grossEarnings - totalDeductions + totalReimbursements;

  return {
    basicMaster,
    basicEarnings,
    otMaster,
    otEarnings,
    halfDayDeductions,
    unpaidOffDeductions,
    grossEarnings,
    totalDeductions,
    totalReimbursements,
    netPayable,
    netPayableWords: numberToIndianWords(netPayable),
    incomeTaxDeduction,
    professionTax,
    pf,
    otherDeduction3,
    compensationOff,
    incentives,
    travelAllowance,
    otherEarning1,
    reimbursement1,
    reimbursement2,
  };
}

module.exports = { computeAttendanceSummary, computeSalary, ATTENDANCE_STATUS };
