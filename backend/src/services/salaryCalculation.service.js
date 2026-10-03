const ApiError = require('../utils/ApiError');
const { numberToIndianWords } = require('./mergeData.service');
const attendanceRepository = require('../repositories/attendance.repository');
const holidayRepository = require('../repositories/holiday.repository');
const { ATTENDANCE_STATUS, PAID_LEAVE_COMPENSATION_FROM } = require('../config/constants');
const { isPastProbation, probationEndDate } = require('../utils/probation');
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

function startOfUTCDate(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

// Monday of the Monday–Sunday week `date` falls in.
function weekMonday(date) {
  return addDays(date, -((date.getUTCDay() + 6) % 7));
}

// The part of [startDate, endDate] the employee was actually employed for —
// from their dateOfJoining and, once offboarded, up to their last day
// (endDate on the Employee record). Days outside it are neither paid nor
// counted as absent; they simply aren't part of the slip. Returns
// { startDate, endDate } with startDate > endDate when there's no overlap.
function clipToEmployment(employee, startDate, endDate) {
  const joinDate = employee.dateOfJoining ? startOfUTCDate(employee.dateOfJoining) : null;
  const exitDate = employee.endDate ? startOfUTCDate(employee.endDate) : null;
  return {
    startDate: joinDate && joinDate > startDate ? joinDate : startDate,
    endDate: exitDate && exitDate < endDate ? exitDate : endDate,
  };
}

// Days that count as "worked" for paid leave compensation — present in
// any form, including from home.
const WORKED_STATUSES = new Set([
  ATTENDANCE_STATUS.PRESENT,
  ATTENDANCE_STATUS.LATE,
  ATTENDANCE_STATUS.SHORT_LEAVE,
  ATTENDANCE_STATUS.HALF_DAY,
  ATTENDANCE_STATUS.WORK_FROM_HOME,
]);

function ddmmyyyy(date) {
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
}

// Paid Leave Compensation — one day's pay when the employee didn't take
// their own paid leave that month. Decided purely from attendance, and only
// when ALL of these hold:
//  * the slip is for one whole calendar month (1st to last day), from
//    PAID_LEAVE_COMPENSATION_FROM onwards;
//  * the employee was employed for that whole month;
//  * probation was already over when the month started (utils/probation.js);
//  * they worked at least one day that month (P, L, SL, H or W);
//  * none of the month's O days is their own (paid leave HR awarded —
//    paidLeaveAwarded — never counts).
// Always returns why, so the slip can say so either way.
function paidLeaveCompensationFor(employee, requestedStart, requestedEnd, employed, records) {
  const takenDates = records.filter((r) => r.status === ATTENDANCE_STATUS.PAID_LEAVE && !r.paidLeaveAwarded).map((r) => r.date);
  const awardedDates = records.filter((r) => r.status === ATTENDANCE_STATUS.PAID_LEAVE && r.paidLeaveAwarded).map((r) => r.date);
  const result = (eligible, reason) => ({ eligible, reason, takenDates, awardedDates });

  const monthStart = new Date(Date.UTC(requestedStart.getUTCFullYear(), requestedStart.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(requestedStart.getUTCFullYear(), requestedStart.getUTCMonth() + 1, 0));
  if (requestedStart.getTime() !== monthStart.getTime() || requestedEnd.getTime() !== monthEnd.getTime()) {
    return result(false, 'Only on a whole-month slip (1st to last day of the month)');
  }
  if (monthStart.getTime() < new Date(`${PAID_LEAVE_COMPENSATION_FROM}T00:00:00.000Z`).getTime()) {
    return result(false, 'Applies from September 2026 slips onwards');
  }
  if (employed.startDate.getTime() !== monthStart.getTime() || employed.endDate.getTime() !== monthEnd.getTime()) {
    return result(false, 'Not employed for the whole month');
  }
  if (!isPastProbation(employee, monthStart)) {
    const end = probationEndDate(employee);
    return result(false, end ? `On probation until ${ddmmyyyy(end)}` : 'On probation');
  }
  if (!records.some((r) => WORKED_STATUSES.has(r.status))) {
    return result(false, 'No day worked this month');
  }
  if (takenDates.length > 0) {
    return result(false, `Own paid leave taken on ${takenDates.map(ddmmyyyy).join(', ')}`);
  }
  return result(true, 'No paid leave taken this month — 1 day paid');
}

// A working day with no attendance record, no status (e.g. a record that
// only logs overtime), or status Absent earns nothing.
function isUnpaidWorkingDay(record) {
  return !record || !record.status || record.status === ATTENDANCE_STATUS.ABSENT;
}

// Attendance is stored one record per calendar day, so any admin-picked
// [startDate, endDate] range (inclusive, both UTC midnight) can be
// summarized directly — nothing here is anchored to a calendar month. The
// range is first clipped to the employee's employment (see
// clipToEmployment); summary.startDate/endDate are the clipped dates.
//
// Day counts: every working day (not Sunday/holiday) is either unpaid (see
// isUnpaidWorkingDay) or paid. A Sunday or company holiday is paid unless
// the employee was unpaid on every working day of that Monday–Sunday week
// (the whole-week rule), so someone absent all week isn't paid for that
// week's off days. totalWorkingDays = every paid day, Sundays/holidays
// included; daysWorked = totalWorkingDays minus half a day per half-day
// unit, and is exactly what Basic pay is computed from.
async function computeAttendanceSummary(employee, requestedStart, requestedEnd) {
  const { startDate, endDate } = clipToEmployment(employee, requestedStart, requestedEnd);
  if (startDate.getTime() > endDate.getTime()) {
    throw ApiError.badRequest('The employee was not employed during this period');
  }

  // The whole-week rule can need attendance from just outside the pay
  // period (a week that starts in the previous month), but never from
  // outside the employment itself.
  const employment = clipToEmployment(employee, weekMonday(startDate), addDays(weekMonday(endDate), 6));
  const [allRecords, holidays] = await Promise.all([
    attendanceRepository.listForEmployee(employee._id, { from: employment.startDate, to: employment.endDate }),
    holidayRepository.list({ from: employment.startDate, to: employment.endDate }),
  ]);
  const inPeriod = (date) => date.getTime() >= startDate.getTime() && date.getTime() <= endDate.getTime();
  const records = allRecords.filter((r) => inPeriod(r.date));

  const totalDaysInPeriod = Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
  const holidayDateKeys = new Set(holidays.map((h) => dateKey(h.date)));
  const recordByDate = new Map(allRecords.map((r) => [dateKey(r.date), r]));

  // Off days in a week are paid if at least one working day that week
  // (within employment) was paid. A week with no working days at all inside
  // employment has nothing to judge by, so its off days stay paid.
  function isOffDayPaid(date) {
    const monday = weekMonday(date);
    let workingDays = 0;
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(monday, i);
      if (day < employment.startDate || day > employment.endDate) continue;
      if (isOffDay(day, holidayDateKeys)) continue;
      workingDays += 1;
      if (!isUnpaidWorkingDay(recordByDate.get(dateKey(day)))) return true;
    }
    return workingDays === 0;
  }

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
  const unpaidOffDateKeys = new Set();
  // Working days carrying no status — almost always a day that needs
  // marking (e.g. only overtime was logged). Unpaid, and listed so HR can
  // fix the attendance before generating.
  const unmarkedWorkingDates = [];
  for (let i = 0; i < totalDaysInPeriod; i += 1) {
    const date = addDays(startDate, i);
    if (isOffDay(date, holidayDateKeys)) {
      offDaysInPeriod += 1;
      if (!isOffDayPaid(date)) unpaidOffDateKeys.add(dateKey(date));
      continue;
    }
    const record = recordByDate.get(dateKey(date));
    if (isUnpaidWorkingDay(record)) {
      unpaidAbsentDays += 1;
      if (record && !record.status) unmarkedWorkingDates.push(date);
    }
  }

  const paidLeave = paidLeaveCompensationFor(employee, requestedStart, requestedEnd, { startDate, endDate }, records);

  const workingDaysInPeriod = totalDaysInPeriod - offDaysInPeriod;
  const unpaidOffDays = unpaidOffDateKeys.size;

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

  // Every paid day — present in any form (P, L, SL, H, W) or on Paid Leave,
  // plus paid Sundays/holidays. e.g. 10 days attended incl. 2 Half Days ->
  // totalWorkingDays 10, daysWorked 9.
  const totalWorkingDays = totalDaysInPeriod - unpaidAbsentDays - unpaidOffDays;
  const daysWorked = totalWorkingDays - totalHalfDayUnits * 0.5;

  return {
    startDate,
    endDate,
    totalDaysInPeriod,
    // Divides by the requested months' length, not the clipped period, so a
    // mid-month joiner's daily rate is the normal one.
    dailyRateDivisor: minDaysAcrossTouchedMonths(requestedStart, requestedEnd),
    workingDaysInPeriod,
    offDaysInPeriod,
    unpaidOffDays,
    unpaidOffDateKeys,
    unmarkedWorkingDates,
    counts,
    totalWorkingDays,
    daysWorked,
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
    paidLeave,
    records,
    holidays,
  };
}

// "Five Thousand Three Hundred Fifty Seven Rupees and Forty Paise" — whole
// rupees are floored (not rounded) so the paise part is never counted twice.
function amountInWords(amount) {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  const words = `${numberToIndianWords(rupees)} Rupees`;
  return paise > 0 ? `${words} and ${numberToIndianWords(paise)} Paise` : words;
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
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

  const halfDayDeductions = summary.totalHalfDayUnits * (dailyRate / 2);
  // Unpaid working days plus Sundays/holidays lost under the whole-week rule
  // (see computeAttendanceSummary).
  const unpaidOffDeductions = (summary.unpaidAbsentDays + summary.unpaidOffDays) * dailyRate;

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
  // One day's pay — see paidLeaveCompensationFor.
  const paidLeaveCompensation = summary.paidLeave?.eligible ? dailyRate : 0;
  const totalReimbursements = reimbursement1 + reimbursement2;

  // Every amount is rounded to the paisa, and the totals are re-added from
  // the rounded lines, so the slip's lines always add up to exactly its
  // totals.
  const rounded = {
    basicEarnings: round2(basicEarnings),
    otEarnings: round2(otEarnings),
    halfDayDeductions: round2(halfDayDeductions),
    unpaidOffDeductions: round2(unpaidOffDeductions),
    paidLeaveCompensation: round2(paidLeaveCompensation),
  };
  const roundedGross = round2(
    rounded.basicEarnings +
      rounded.otEarnings +
      rounded.paidLeaveCompensation +
      compensationOff +
      incentives +
      travelAllowance +
      otherEarning1
  );
  const roundedDeductions = round2(
    incomeTaxDeduction + professionTax + pf + rounded.halfDayDeductions + rounded.unpaidOffDeductions + otherDeduction3
  );
  const roundedNet = round2(roundedGross - roundedDeductions + totalReimbursements);

  return {
    basicMaster: round2(basicMaster),
    basicEarnings: rounded.basicEarnings,
    otMaster: rounded.otEarnings,
    otEarnings: rounded.otEarnings,
    paidLeaveCompensation: rounded.paidLeaveCompensation,
    halfDayDeductions: rounded.halfDayDeductions,
    unpaidOffDeductions: rounded.unpaidOffDeductions,
    grossEarnings: roundedGross,
    totalDeductions: roundedDeductions,
    totalReimbursements: round2(totalReimbursements),
    netPayable: roundedNet,
    netPayableWords: amountInWords(roundedNet),
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

module.exports = { computeAttendanceSummary, computeSalary, clipToEmployment, ATTENDANCE_STATUS };
