const fs = require('node:fs/promises');
const path = require('node:path');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const employeeRepository = require('../repositories/employee.repository');
const salarySlipRepository = require('../repositories/salarySlip.repository');
const localFileStorage = require('../services/localFileStorage.service');
const salaryCalculation = require('./salaryCalculation.service');
const { fillTemplate, renderPdfFromHtml } = require('./htmlRender.service');
const { dateKey } = require('../utils/attendanceDays');

const NAMESPACE = 'salary-slips';
const TEMPLATE_FILE = 'salary-slip.html';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STATUS_BG = { P: '#cceecc', O: '#c7e0ff', H: '#fff2b3', L: '#ffd8a8', SL: '#ffc7c7', W: '#e0d0ff' };
const OFF_BG = '#d9d9d9';
const UNPAID_BG = '#ffb3b3';

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDateLong(date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Non-breaking hyphen (U+2011) rather than "-" — a plain hyphen is a valid
// soft-wrap point in CSS text flow, which was splitting "05-07-2026" across
// two lines in the narrow info-table cells.
function formatDateDDMMYYYY(date) {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}‑${m}‑${date.getUTCFullYear()}`;
}

// One grid cell per day, plus leading blanks so day 1 lands under the
// correct weekday column — fed as a single flat loop into the template's
// CSS grid (see htmlRender.service.js's {#loop} support).
function buildAttendanceDays(startDate, summary) {
  const holidayKeys = new Set(summary.holidays.map((h) => dateKey(h.date)));
  const recordByDate = new Map(summary.records.map((r) => [dateKey(r.date), r]));
  const firstWeekday = startDate.getUTCDay();

  const days = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    days.push({ dayNum: '', bg: 'transparent', statusText: '', otText: '' });
  }
  for (let i = 0; i < summary.totalDaysInPeriod; i += 1) {
    const date = new Date(startDate.getTime() + i * MS_PER_DAY);
    const key = dateKey(date);
    const record = recordByDate.get(key);
    const isSunday = date.getUTCDay() === 0;
    const isHoliday = holidayKeys.has(key);

    let bg = '#ffffff';
    let statusText = '';
    if (record?.status) {
      bg = STATUS_BG[record.status] || bg;
      statusText = record.status;
    } else if (isSunday || isHoliday) {
      bg = OFF_BG;
      statusText = isHoliday ? 'HOL' : '';
    } else if (!record) {
      bg = UNPAID_BG;
    }
    const otText = record?.overtimeHours ? `+${record.overtimeHours}h OT` : '';

    days.push({ dayNum: String(date.getUTCDate()), bg, statusText, otText });
  }
  return days;
}

function buildMergeData(employee, startDate, endDate, summary, salary) {
  const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
  const payDate = employee.payDate
    ? new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), Math.min(employee.payDate, 28)))
    : null;

  return {
    employeeName,
    panNumber: employee.panNumber || '',
    designation: employee.designation || '',
    bankName: employee.bankName || '',
    employeeCode: employee.employeeCode || '',
    bankAccountNumber: employee.bankAccountNumber || '',
    dateOfJoiningFormatted: employee.dateOfJoining ? formatDateDDMMYYYY(new Date(employee.dateOfJoining)) : '',
    bankIFSC: employee.bankIFSC || '',
    department: employee.department || '',
    payDateFormatted: payDate ? formatDateDDMMYYYY(payDate) : '',
    daysWorked: String(summary.daysWorkedTotal),
    totalDaysInPeriod: String(summary.totalDaysInPeriod),
    periodLabel: `${formatDateLong(startDate)} – ${formatDateLong(endDate)}`,

    basicMaster: formatCurrency(salary.basicMaster),
    basicEarnings: formatCurrency(salary.basicEarnings),
    otMaster: formatCurrency(salary.otMaster),
    otEarnings: formatCurrency(salary.otEarnings),
    compensationOff: formatCurrency(salary.compensationOff),
    incentives: formatCurrency(salary.incentives),
    travelAllowance: formatCurrency(salary.travelAllowance),
    otherEarning1: formatCurrency(salary.otherEarning1),
    grossEarnings: formatCurrency(salary.grossEarnings),

    incomeTaxDeduction: formatCurrency(salary.incomeTaxDeduction),
    professionTax: formatCurrency(salary.professionTax),
    pf: formatCurrency(salary.pf),
    halfDayDeductions: formatCurrency(salary.halfDayDeductions),
    unpaidOffDeductions: formatCurrency(salary.unpaidOffDeductions),
    otherDeduction3: formatCurrency(salary.otherDeduction3),
    totalDeductions: formatCurrency(salary.totalDeductions),

    reimbursement1: formatCurrency(salary.reimbursement1),
    reimbursement2: formatCurrency(salary.reimbursement2),
    totalReimbursements: formatCurrency(salary.totalReimbursements),

    netPayable: (Number(salary.netPayable) || 0).toFixed(2),
    netPayableWords: salary.netPayableWords,

    countP: String(summary.counts.P),
    countO: String(summary.counts.O),
    countH: String(summary.counts.H),
    countL: String(summary.counts.L),
    countSL: String(summary.counts.SL),
    countW: String(summary.counts.W),
    totalOvertimeHours: String(summary.totalOvertimeHours),
    workingDaysInPeriod: String(summary.workingDaysInPeriod),
    offDaysInPeriod: String(summary.totalDaysInPeriod - summary.workingDaysInPeriod),
    unpaidAbsentDays: String(summary.unpaidAbsentDays),

    attendanceDays: buildAttendanceDays(startDate, summary),
  };
}

async function generateSlip(employeeId, input, createdBy) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const { startDate: startStr, endDate: endStr, ...manualInputs } = input;

  const startDate = new Date(`${startStr}T00:00:00.000Z`);
  const endDate = new Date(`${endStr}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw ApiError.badRequest('Invalid start or end date');
  }
  if (endDate.getTime() < startDate.getTime()) {
    throw ApiError.badRequest('End date must be on or after the start date');
  }
  if (endDate.getTime() > Date.now()) {
    throw ApiError.badRequest('End date cannot be in the future');
  }

  const summary = await salaryCalculation.computeAttendanceSummary(employeeId, startDate, endDate);
  const salary = salaryCalculation.computeSalary(employee, summary, manualInputs);

  const mergeData = buildMergeData(employee, startDate, endDate, summary, salary);
  const templateHtml = await fs.readFile(path.join(env.templatesHtmlDir, TEMPLATE_FILE), 'utf8');
  const filledHtml = fillTemplate(templateHtml, mergeData);
  const pdfBuffer = await renderPdfFromHtml(filledHtml, env.templatesHtmlDir);

  const relativePath = path.join(String(employeeId), `${startStr}_${endStr}-${Date.now()}.pdf`);
  const filePath = await localFileStorage.saveBuffer(pdfBuffer, relativePath, NAMESPACE);

  return salarySlipRepository.create({
    employee: employeeId,
    startDate,
    endDate,
    ...manualInputs,
    basicMaster: salary.basicMaster,
    basicEarnings: salary.basicEarnings,
    otMaster: salary.otMaster,
    otEarnings: salary.otEarnings,
    halfDayDeductions: salary.halfDayDeductions,
    unpaidOffDeductions: salary.unpaidOffDeductions,
    grossEarnings: salary.grossEarnings,
    totalDeductions: salary.totalDeductions,
    totalReimbursements: salary.totalReimbursements,
    netPayable: salary.netPayable,
    netPayableWords: salary.netPayableWords,
    generatedFile: { filePath },
    createdBy,
  });
}

async function listForEmployee(employeeId) {
  return salarySlipRepository.listByEmployee(employeeId);
}

async function getFilePath(id) {
  const slip = await salarySlipRepository.findById(id);
  if (!slip) throw ApiError.notFound('Salary slip not found');
  return { filePath: slip.generatedFile.filePath, namespace: NAMESPACE };
}

module.exports = { generateSlip, listForEmployee, getFilePath };
