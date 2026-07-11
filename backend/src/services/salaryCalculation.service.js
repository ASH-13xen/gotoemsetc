const { numberToIndianWords } = require('./mergeData.service');
const attendanceRepository = require('../repositories/attendance.repository');
const holidayRepository = require('../repositories/holiday.repository');
const { ATTENDANCE_STATUS } = require('../config/constants');
const { dateKey, isOffDay } = require('../utils/attendanceDays');

// From 1st of the target month through the manually-selected cutoff date
// (inclusive) — this is the period a slip covers, distinct from the full
// calendar month used only as the daily-rate denominator.
async function computeAttendanceSummary(employeeId, year, month, cutoffDate) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month - 1, cutoffDate.getUTCDate()));

  const [records, holidays] = await Promise.all([
    attendanceRepository.listForEmployee(employeeId, { from, to }),
    holidayRepository.list({ from, to }),
  ]);

  const totalDaysInPeriod = to.getUTCDate();
  const daysInCalendarMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const holidayDateKeys = new Set(holidays.map((h) => dateKey(h.date)));

  const recordByDate = new Map(records.map((r) => [dateKey(r.date), r]));

  const counts = { P: 0, O: 0, H: 0, L: 0, SL: 0, W: 0 };
  let totalOvertimeHours = 0;
  for (const record of records) {
    if (record.status) counts[record.status] += 1;
    totalOvertimeHours += record.overtimeHours || 0;
  }

  let offDaysInPeriod = 0;
  let unpaidAbsentDays = 0;
  for (let day = 1; day <= totalDaysInPeriod; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const off = isOffDay(date, holidayDateKeys);
    if (off) {
      offDaysInPeriod += 1;
      continue;
    }
    if (!recordByDate.has(dateKey(date))) unpaidAbsentDays += 1;
  }

  const workingDaysInPeriod = totalDaysInPeriod - offDaysInPeriod;

  const daysWorkedTotal = counts.P + counts.O + counts.W + counts.L + counts.SL + counts.H * 0.5;

  // >2 late = 1 short leave; >2 short leave (incl. converted lates) = 1 half day.
  const lateToSLUnits = Math.floor(counts.L / 3);
  const effectiveSLUnits = counts.SL + lateToSLUnits;
  const halfDayPenaltyUnits = Math.floor(effectiveSLUnits / 3);

  return {
    totalDaysInPeriod,
    daysInCalendarMonth,
    workingDaysInPeriod,
    counts,
    daysWorkedTotal,
    halfDayPenaltyUnits,
    unpaidAbsentDays,
    totalOvertimeHours,
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
  const dailyRate = summary.daysInCalendarMonth > 0 ? basicMaster / summary.daysInCalendarMonth : 0;
  const basicEarnings = dailyRate * summary.daysWorkedTotal;

  const otMaster = summary.workingDaysInPeriod > 0 ? basicMaster / summary.workingDaysInPeriod / 8 : 0;
  const otEarnings = otMaster * summary.totalOvertimeHours;

  const halfDayDeductions = summary.halfDayPenaltyUnits * (dailyRate / 2);
  const unpaidOffDeductions = summary.unpaidAbsentDays * dailyRate;

  const grossEarnings = basicEarnings + otEarnings + compensationOff + incentives + travelAllowance + otherEarning1;
  const totalDeductions =
    incomeTaxDeduction + professionTax + pf + halfDayDeductions + unpaidOffDeductions + otherDeduction3;
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
