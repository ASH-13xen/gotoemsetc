const { numberToIndianWords } = require('./mergeData.service');
const attendanceRepository = require('../repositories/attendance.repository');
const holidayRepository = require('../repositories/holiday.repository');
const { ATTENDANCE_STATUS } = require('../config/constants');
const { dateKey, isOffDay } = require('../utils/attendanceDays');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

  const counts = { P: 0, O: 0, H: 0, L: 0, SL: 0, W: 0 };
  let totalOvertimeHours = 0;
  for (const record of records) {
    if (record.status) counts[record.status] += 1;
    totalOvertimeHours += record.overtimeHours || 0;
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
  // Prorated by the number of days actually in the selected period, rather
  // than a fixed calendar month — this is what makes an arbitrary
  // start/end range make sense as a pay basis (a 15-day period pays out
  // basicMaster/15 per day worked, not basicMaster/30).
  const dailyRate = summary.totalDaysInPeriod > 0 ? basicMaster / summary.totalDaysInPeriod : 0;
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
