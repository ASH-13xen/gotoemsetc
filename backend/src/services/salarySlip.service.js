const fs = require('node:fs/promises');
const path = require('node:path');
// v8 replaced the old archiver('zip', opts) factory with a class per format
// — ZipArchive still extends the same Transform-stream Archiver core, so
// every other call below (.file/.finalize/.pipe/.on('error')) is unchanged.
const { ZipArchive } = require('archiver');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const employeeRepository = require('../repositories/employee.repository');
const salarySlipRepository = require('../repositories/salarySlip.repository');
const AttendanceRecord = require('../models/AttendanceRecord');
const userRepository = require('../repositories/user.repository');
const localFileStorage = require('../services/localFileStorage.service');
const emailService = require('./email.service');
const notificationService = require('./notification.service');
const salaryCalculation = require('./salaryCalculation.service');
const { fillTemplate, renderPdfFromHtml } = require('./htmlRender.service');
const { dateKey } = require('../utils/attendanceDays');
const { istMonthRange } = require('../utils/istDate');
const { ATTENDANCE_STATUS, NOTIFICATION_TYPES, EMPLOYEE_STATUS } = require('../config/constants');
const { LATE_CAP, SL_CAP } = require('../utils/attendancePenalties');
const { isSelf } = require('../utils/roles');
const { ACCESS, GRANTS } = require('../config/access');
const accessService = require('./access.service');

const NAMESPACE = 'salary-slips';
const TEMPLATE_FILE = 'salary-slip.html';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STATUS_BG = { P: '#cceecc', O: '#c7e0ff', H: '#fff2b3', L: '#ffd8a8', SL: '#ffc7c7', W: '#e0d0ff' };
const OFF_BG = '#d9d9d9';
const UNPAID_BG = '#ffb3b3';

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Day counts can be fractional (half days) — "9.5", "10", never "10.0".
function formatDays(value) {
  return String(Number((Number(value) || 0).toFixed(1)));
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
function buildAttendanceDays(summary) {
  const { startDate } = summary;
  const holidayKeys = new Set(summary.holidays.map((h) => dateKey(h.date)));
  const recordByDate = new Map(summary.records.map((r) => [dateKey(r.date), r]));
  const firstWeekday = startDate.getUTCDay();

  const days = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    days.push({ dayNum: '', bg: 'transparent', statusText: '', otText: '', edText: '' });
  }
  for (let i = 0; i < summary.totalDaysInPeriod; i += 1) {
    const date = new Date(startDate.getTime() + i * MS_PER_DAY);
    const key = dateKey(date);
    const record = recordByDate.get(key);
    const isSunday = date.getUTCDay() === 0;
    const isHoliday = holidayKeys.has(key);

    let bg = '#ffffff';
    let statusText = '';
    if ((isSunday || isHoliday) && summary.unpaidOffDateKeys.has(key)) {
      // A Sunday/holiday lost under the whole-week rule (absent every
      // working day that week) — see salaryCalculation.service.js.
      bg = UNPAID_BG;
      statusText = isHoliday ? 'HOL ✗' : 'OFF ✗';
    } else if (record?.status === ATTENDANCE_STATUS.HOLIDAY) {
      // Auto-marked on every employee the instant a day is marked a company
      // holiday (see attendanceClassifier.service.js#applyHolidayForEmployee)
      // — still reads as a plain off day here, same as before that existed.
      bg = OFF_BG;
      statusText = 'HOL';
    } else if (record?.status === ATTENDANCE_STATUS.ABSENT) {
      bg = UNPAID_BG;
      statusText = 'A';
    } else if (record?.status) {
      bg = STATUS_BG[record.status] || bg;
      // O* = an Absent the slip converted to the month's paid off.
      statusText = record.status === ATTENDANCE_STATUS.PAID_LEAVE && record.autoPaidOffNote ? 'O*' : record.status;
    } else if (isSunday || isHoliday) {
      bg = OFF_BG;
      statusText = isHoliday ? 'HOL' : '';
    } else if (!record || !record.status) {
      // Never marked, or a record that only logs overtime — unpaid either way.
      bg = UNPAID_BG;
      statusText = record ? '?' : '';
    }
    const otText = record?.overtimeMinutes ? `+${record.overtimeMinutes}min OT` : '';
    // Independent of status — a day can show e.g. "SL" and still have left
    // early on top of that (see the Deduction Calculation section below for
    // exactly how that second flag gets counted), so it needs its own
    // marker rather than being folded into statusText.
    const edText = record?.earlyDeparture ? 'ED' : '';

    days.push({ dayNum: String(date.getUTCDate()), bg, statusText, otText, edText });
  }
  return days;
}

// {#loop} items need every referenced field present on every item (an
// absent key just leaves the literal "{tag}" in the output — see
// htmlRender.service.js#fillTemplate) — and an empty array renders nothing
// at all, which would silently look like the section was left out rather
// than "genuinely zero this period". This guarantees at least one row
// either way.
function formatBreakdownRows(events, { includeOutcome }) {
  if (events.length === 0) {
    return [{ dateFormatted: '—', reason: 'None this period', outcomeLabel: '' }];
  }
  return events.map((e) => ({
    dateFormatted: formatDateDDMMYYYY(e.date),
    reason: e.reason,
    outcomeLabel: includeOutcome ? e.outcomeLabel : '',
  }));
}

function buildMergeData(employee, summary, salary) {
  const { startDate, endDate } = summary;
  const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
  // The first occurrence of the employee's pay day *after* the period ends
  // — e.g. pay day 5 for a September slip is 5 October, never 5 September
  // (which would be before the work being paid for was even done).
  let payDate = null;
  if (employee.payDate) {
    const day = Math.min(employee.payDate, 28);
    payDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), day));
    if (payDate.getTime() <= endDate.getTime()) {
      payDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, day));
    }
  }

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
    totalWorkingDays: formatDays(summary.totalWorkingDays),
    daysWorked: formatDays(summary.daysWorked),
    totalDaysInPeriod: String(summary.totalDaysInPeriod),
    periodLabel: `${formatDateLong(startDate)} – ${formatDateLong(endDate)}`,

    basicMaster: formatCurrency(salary.basicMaster),
    basicEarnings: formatCurrency(salary.basicEarnings),
    otMaster: formatCurrency(salary.otMaster),
    otEarnings: formatCurrency(salary.otEarnings),
    compensationOff: formatCurrency(salary.compensationOff),
    incentives: formatCurrency(salary.incentives),
    travelAllowance: formatCurrency(salary.travelAllowance),
    // Manual Other Earning plus the one day's pay for an unused paid off.
    otherEarning1: formatCurrency((salary.otherEarning1 || 0) + (salary.paidLeaveCompensation || 0)),
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

    netPayable: formatCurrency(salary.netPayable),
    netPayableWords: salary.netPayableWords,

    countP: String(summary.counts.P),
    countO: String(summary.counts.O),
    paidLeaveNote: summary.paidLeave.reason,
    countH: String(summary.counts.H),
    countL: String(summary.counts.L),
    countSL: String(summary.counts.SL),
    countW: String(summary.counts.W),
    totalOvertimeMinutes: String(summary.totalOvertimeMinutes),
    workingDaysInPeriod: String(summary.workingDaysInPeriod),
    offDaysInPeriod: String(summary.offDaysInPeriod),
    unpaidOffDays: String(summary.unpaidOffDays),
    unpaidAbsentDays: String(summary.unpaidAbsentDays),
    halfDayUnitsDeducted: formatDays(summary.totalHalfDayUnits * 0.5),

    // Exact per-date reasoning behind the Half Day Deductions line — see
    // attendancePenalties.js#computeEffectiveUnitsBreakdown. Every Late and
    // every Short-Leave-pool date is listed with whether it counted normally
    // or escalated, so an employee can trace the final deduction back to
    // specific dates instead of just a total.
    lateCap: String(LATE_CAP),
    slCap: String(SL_CAP),
    totalHalfDayUnits: String(summary.totalHalfDayUnits),
    lateEvents: formatBreakdownRows(summary.deductionBreakdown.lateEvents, { includeOutcome: true }),
    slEvents: formatBreakdownRows(summary.deductionBreakdown.slEvents, { includeOutcome: true }),
    halfDayEvents: formatBreakdownRows(summary.deductionBreakdown.halfDayEvents, { includeOutcome: false }),

    attendanceDays: buildAttendanceDays(summary),
  };
}

// Calculates and renders one slip without saving anything — the period is
// clipped to the employee's employment dates inside
// computeAttendanceSummary. Used by generateSlip (which then persists it)
// and by previews.
async function renderSlip(employee, startDate, endDate, manualInputs = {}) {
  const summary = await salaryCalculation.computeAttendanceSummary(employee, startDate, endDate);
  const salary = salaryCalculation.computeSalary(employee, summary, manualInputs);
  const mergeData = buildMergeData(employee, summary, salary);
  const templateHtml = await fs.readFile(path.join(env.templatesHtmlDir, TEMPLATE_FILE), 'utf8');
  const filledHtml = fillTemplate(templateHtml, mergeData);
  const pdfBuffer = await renderPdfFromHtml(filledHtml, env.templatesHtmlDir);
  return { summary, salary, pdfBuffer };
}

async function generateSlip(employeeId, input, createdBy, actor) {
  if (isSelf(actor, employeeId)) throw ApiError.forbidden("You can't generate your own salary slip — someone else has to");
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');
  if (employee.excludeFromPayroll) throw ApiError.badRequest('This employee is excluded from payroll');

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

  const { summary, salary, pdfBuffer } = await renderSlip(employee, startDate, endDate, manualInputs);

  // The slip counted the first Absent as this month's paid off (see
  // salaryCalculation.service.js#settlePaidOff) — make attendance say so,
  // with a line telling exactly what happened.
  if (summary.paidLeave.convertedDate) {
    const monthLabel = startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    await AttendanceRecord.updateOne(
      { employee: employeeId, date: summary.paidLeave.convertedDate },
      {
        $set: {
          status: ATTENDANCE_STATUS.PAID_LEAVE,
          isAutoMarked: false,
          autoPaidOffNote: `Auto-converted from Absent to Paid Off by the ${monthLabel} salary slip on ${formatDateDDMMYYYY(new Date())} — the employee had not used this month's paid off.`,
        },
      }
    );
  }

  const relativePath = path.join(
    String(employeeId),
    `${toDateStr(summary.startDate)}_${toDateStr(summary.endDate)}-${Date.now()}.pdf`
  );
  const filePath = await localFileStorage.saveBuffer(pdfBuffer, relativePath, NAMESPACE);

  // The clipped dates (actual employment within the requested range) are
  // what's stored, so the slip record matches what it pays for.
  return salarySlipRepository.create({
    employee: employeeId,
    startDate: summary.startDate,
    endDate: summary.endDate,
    ...manualInputs,
    basicMaster: salary.basicMaster,
    basicEarnings: salary.basicEarnings,
    otMaster: salary.otMaster,
    otEarnings: salary.otEarnings,
    paidLeaveCompensation: salary.paidLeaveCompensation,
    halfDayDeductions: salary.halfDayDeductions,
    unpaidOffDeductions: salary.unpaidOffDeductions,
    grossEarnings: salary.grossEarnings,
    totalDeductions: salary.totalDeductions,
    totalReimbursements: salary.totalReimbursements,
    netPayable: salary.netPayable,
    netPayableWords: salary.netPayableWords,
    generatedFile: { filePath },
    createdBy,
    createdAs: actor ? accessService.actingRole(actor, GRANTS[ACCESS.EMS_ALL]) : undefined,
  });
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

// HR Work's "Generate all salary slips together" (frontendhr). One calendar
// month, every active employee plus anyone who left during or after it —
// reuses generateSlip's exact code path per employee (same persisted
// SalarySlip + PDF-on-disk as the single-employee generator, nothing
// skipped). Clipping to each person's joining/leaving date happens inside
// the calculation itself (salaryCalculation.service.js#clipToEmployment), so
// a mid-month joiner or leaver is paid only for the days they were employed.
async function generateBulkSlips({ month, year }, createdBy, actor) {
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0));
  if (periodEnd.getTime() > Date.now()) {
    throw ApiError.badRequest('Cannot generate salary slips for a period that has not ended yet');
  }

  const employees = await employeeRepository.listPayableForPeriod(periodStart);
  const results = [];

  for (const employee of employees) {
    const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
    const row = { employeeId: employee._id, employeeName, employeeCode: employee.employeeCode };

    const employment = salaryCalculation.clipToEmployment(employee, periodStart, periodEnd);
    if (employment.startDate.getTime() > employment.endDate.getTime()) {
      results.push({ ...row, outcome: 'skipped', message: 'Not employed during this period' });
      continue;
    }

    if (isSelf(actor, employee._id)) {
      results.push({ ...row, outcome: 'skipped', message: 'Your own slip — someone else has to generate it' });
      continue;
    }

    try {
      const slip = await generateSlip(
        employee._id.toString(),
        { startDate: toDateStr(periodStart), endDate: toDateStr(periodEnd) },
        createdBy,
        actor
      );
      results.push({ ...row, outcome: 'generated', slipId: slip._id, netPayable: slip.netPayable });
    } catch (err) {
      results.push({ ...row, outcome: 'failed', message: err.message });
    }
  }

  return results;
}

const MASTER_SHEET_TEMPLATE_FILE = 'master-salary-sheet.html';

// HR Work's Master Salary Sheet — one PDF listing every active employee for
// a calendar month: current monthly salary, days worked, overtime minutes
// and net payable, as a final cross-check before paying out. Net payable
// comes from that month's latest generated slip (exactly what's being paid);
// an employee with no slip yet is calculated live with no manual
// additions/deductions and flagged as such. Attendance and overtime are
// always computed fresh, clipped to each person's employment dates.
// `useGeneratedSlips: false` ignores saved slips and calculates every row
// live (used for previews before slips are regenerated).
async function buildMasterSheet({ month, year }, { useGeneratedSlips = true } = {}) {
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0));
  if (periodEnd.getTime() > Date.now()) {
    throw ApiError.badRequest('Cannot build the master salary sheet for a month that has not ended yet');
  }

  const [employees, slips] = await Promise.all([
    employeeRepository.listPayableForPeriod(periodStart),
    salarySlipRepository.listByStartDateMonth(periodStart, new Date(Date.UTC(year, month, 1))),
  ]);
  // Sorted newest first, so the first slip seen per employee is their latest.
  const latestSlipByEmployee = new Map();
  for (const slip of slips) {
    const key = slip.employee?._id?.toString();
    if (key && !latestSlipByEmployee.has(key)) latestSlipByEmployee.set(key, slip);
  }

  const rows = [];
  const sorted = [...employees].sort((a, b) =>
    `${a.firstName} ${a.lastName || ''}`.localeCompare(`${b.firstName} ${b.lastName || ''}`)
  );
  for (const employee of sorted) {
    const employment = salaryCalculation.clipToEmployment(employee, periodStart, periodEnd);
    if (employment.startDate.getTime() > employment.endDate.getTime()) continue;

    // eslint-disable-next-line no-await-in-loop
    const summary = await salaryCalculation.computeAttendanceSummary(employee, periodStart, periodEnd);
    const slip = useGeneratedSlips ? latestSlipByEmployee.get(employee._id.toString()) : null;
    const salary = salaryCalculation.computeSalary(employee, summary, {});
    const netPayable = slip ? slip.netPayable || 0 : salary.netPayable;

    let netNote = '';
    if (!salary.basicMaster) netNote = 'No salary set';
    else if (useGeneratedSlips && !slip) netNote = 'Slip not generated';
    if (employee.status === EMPLOYEE_STATUS.OFFBOARDED) netNote = [netNote, 'Left on ' + formatDateDDMMYYYY(employment.endDate)].filter(Boolean).join(' · ');
    if (summary.unmarkedWorkingDates.length > 0) {
      netNote = [netNote, `${summary.unmarkedWorkingDates.length} unmarked day(s)`].filter(Boolean).join(' · ');
    }

    // Only the slip's "Other Deduction 3" field — a live-calculated row has
    // no manual deductions.
    const otherDeduction = slip ? slip.otherDeduction3 || 0 : 0;
    // Manual Other Earning plus the one day's pay for an unused paid off.
    const otherEarning = slip ? (slip.otherEarning1 || 0) + (slip.paidLeaveCompensation || 0) : salary.paidLeaveCompensation;
    rows.push({
      employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
      designation: employee.designation || '',
      currentSalary: salary.basicMaster,
      totalDaysInPeriod: summary.totalDaysInPeriod,
      daysPayable: summary.daysWorked,
      overtimeMinutes: summary.totalOvertimeMinutes,
      otherEarning,
      otherDeduction,
      netPayable,
      netNote,
    });
  }

  return renderMasterSheet({
    periodLabel: periodStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    rows,
  });
}

// Renders the Master Salary Sheet PDF from plain numeric rows — shared by
// buildMasterSheet above and by one-off sheets built from a folder of slip
// PDFs. Each row: { employeeName, designation, currentSalary,
// totalDaysInPeriod, daysPayable, overtimeMinutes, otherEarning,
// otherDeduction, netPayable, netNote? }. Other Earning / Other Deduction
// show "—" when zero.
async function renderMasterSheet({ periodLabel, rows }) {
  const sum = (key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const templateHtml = await fs.readFile(path.join(env.templatesHtmlDir, MASTER_SHEET_TEMPLATE_FILE), 'utf8');
  const filledHtml = fillTemplate(templateHtml, {
    periodLabel,
    employeeCount: rows.length,
    generatedOn: formatDateLong(new Date()),
    rows: rows.map((row, i) => ({
      index: i + 1,
      employeeName: row.employeeName,
      designation: row.designation || '',
      currentSalary: formatCurrency(row.currentSalary),
      totalDaysInPeriod: formatDays(row.totalDaysInPeriod),
      daysPayable: formatDays(row.daysPayable),
      overtimeMinutes: Math.round(row.overtimeMinutes || 0).toLocaleString('en-IN'),
      otherEarning: row.otherEarning ? formatCurrency(row.otherEarning) : '—',
      otherDeduction: row.otherDeduction ? formatCurrency(row.otherDeduction) : '—',
      netPayable: formatCurrency(row.netPayable),
      netNote: row.netNote || '',
    })),
    totalCurrentSalary: formatCurrency(sum('currentSalary')),
    totalOvertimeMinutes: Math.round(sum('overtimeMinutes')).toLocaleString('en-IN'),
    totalOtherEarning: formatCurrency(sum('otherEarning')),
    totalOtherDeduction: formatCurrency(sum('otherDeduction')),
    totalNetPayable: formatCurrency(sum('netPayable')),
  });
  return renderPdfFromHtml(filledHtml, env.templatesHtmlDir, { landscape: true });
}

// HR Work's "Download all as ZIP" companion to generateBulkSlips — bundles
// the already-generated PDFs for a given list of slip ids into one zip
// stream. Returns the archiver instance immediately (before any file has
// actually been added) so the controller can start piping it to the
// response right away; files are queued into it asynchronously as each
// slip's employee is looked up. A slip that's gone missing (deleted
// employee, etc.) is skipped rather than failing the whole download.
function buildBulkZip(slipIds) {
  if (!Array.isArray(slipIds) || slipIds.length === 0) {
    throw ApiError.badRequest('No salary slips to zip');
  }

  const archive = new ZipArchive({ zlib: { level: 9 } });

  (async () => {
    try {
      for (const slipId of slipIds) {
        // eslint-disable-next-line no-await-in-loop
        const slip = await salarySlipRepository.findById(slipId).populate('employee', 'firstName lastName employeeCode');
        if (!slip || !slip.employee) continue;

        const employeeName = `${slip.employee.firstName} ${slip.employee.lastName || ''}`.trim().replace(/[^\w\- ]/g, '') || 'employee';
        const employeeCode = slip.employee.employeeCode || slip.employee._id.toString().slice(-6);
        const entryName = `${employeeCode}_${employeeName}_${toDateStr(slip.startDate)}_${toDateStr(slip.endDate)}.pdf`;
        const absolutePath = localFileStorage.absolutePathFor(slip.generatedFile.filePath, NAMESPACE);
        archive.file(absolutePath, { name: entryName });
      }
      archive.finalize();
    } catch (err) {
      archive.emit('error', err);
    }
  })();

  return archive;
}

async function listForEmployee(employeeId) {
  return salarySlipRepository.listByEmployee(employeeId);
}

async function getFilePath(id) {
  const slip = await salarySlipRepository.findById(id);
  if (!slip) throw ApiError.notFound('Salary slip not found');
  return { filePath: slip.generatedFile.filePath, namespace: NAMESPACE };
}

// Self-service view (frontendall dashboard): the employee never triggers a
// fresh computation or a new stored slip — this only surfaces whichever
// *already-generated* official slips HR has produced, for the 3 most
// recently completed calendar months, never earlier than their date of
// joining. A month with no matching slip yet comes back as `slip: null`
// ("not generated yet") rather than a guess. Matching is by date-range
// overlap since a slip's startDate/endDate isn't required to be a single
// calendar month.
async function listRecentMonthsForEmployee(employeeId) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const allSlips = await salarySlipRepository.listByEmployee(employeeId);
  const joinDate = employee.dateOfJoining ? new Date(employee.dateOfJoining) : null;
  const now = new Date();

  const months = [];
  for (let i = 1; i <= 3; i += 1) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0));
    // Not yet joined as of this month at all — don't even offer the slot.
    if (joinDate && joinDate.getTime() > monthEnd.getTime()) continue;

    const slip = allSlips.find(
      (s) => s.startDate.getTime() <= monthEnd.getTime() && s.endDate.getTime() >= monthStart.getTime()
    );
    months.push({
      month: monthStart.getUTCMonth() + 1,
      year: monthStart.getUTCFullYear(),
      slip: slip
        ? {
            _id: slip._id,
            startDate: slip.startDate,
            endDate: slip.endDate,
            netPayable: slip.netPayable,
          }
        : null,
    });
  }
  return months;
}

// Self-service file download, nested under /employees/:id so the route can
// be self-or-permission gated from the URL alone — still double-checks the
// looked-up slip actually belongs to :employeeId, since :slipId on its own
// doesn't prove that.
async function getOwnFilePath(employeeId, slipId) {
  const slip = await salarySlipRepository.findById(slipId);
  if (!slip || slip.employee.toString() !== employeeId) {
    throw ApiError.notFound('Salary slip not found');
  }
  return { filePath: slip.generatedFile.filePath, namespace: NAMESPACE };
}

// Same pattern as employeeTask.service.js#taskManagerFrom / meeting.service.js
// #meetingsFrom — reuses the one verified RESEND_FROM_EMAIL address under a
// different display name.
function financeFrom() {
  const match = /<([^>]+)>/.exec(env.resend.fromEmail || '');
  const address = match ? match[1] : env.resend.fromEmail;
  return `Finance <${address}>`;
}

// Finance's "which slip counts for this month" view. Pay periods are
// free-form ranges, not calendar months (see the schema comment above), so
// this buckets by the IST month startDate falls in (istMonthRange — same
// helper the CMS calendar uses) and keeps only the most-recently-generated
// slip per employee within that bucket.
async function listDueForFinance(year, month) {
  const { start, end } = istMonthRange(year, month);
  const slips = await salarySlipRepository.listByStartDateMonth(start, end);

  const latestByEmployee = new Map();
  for (const slip of slips) {
    const employeeId = slip.employee?._id?.toString();
    if (!employeeId) continue;
    const existing = latestByEmployee.get(employeeId);
    if (!existing || slip.createdAt > existing.createdAt) {
      latestByEmployee.set(employeeId, slip);
    }
  }
  return [...latestByEmployee.values()].sort((a, b) => {
    const nameA = `${a.employee.firstName} ${a.employee.lastName || ''}`;
    const nameB = `${b.employee.firstName} ${b.employee.lastName || ''}`;
    return nameA.localeCompare(nameB);
  });
}

function salaryPaidEmailHtml(slip, transactionDetails) {
  const employeeName = `${slip.employee.firstName} ${slip.employee.lastName || ''}`.trim();
  const periodLabel = `${slip.startDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })} – ${slip.endDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}`;
  return `<p>Hi ${employeeName},</p>
<p>Your salary for the period <strong>${periodLabel}</strong> has been paid.</p>
<p><strong>Net payable:</strong> ₹${(Number(slip.netPayable) || 0).toLocaleString('en-IN')}<br/>
<strong>Payment mode:</strong> ${transactionDetails.mode || '—'}<br/>
<strong>Reference number:</strong> ${transactionDetails.referenceNumber || '—'}<br/>
<strong>Paid on:</strong> ${transactionDetails.paidOn ? new Date(transactionDetails.paidOn).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}</p>
${transactionDetails.note ? `<p>${transactionDetails.note}</p>` : ''}
<p>Thanks,<br/>Finance</p>`;
}

// requireFinanceAccess-gated. Marks the slip paid, emails the employee's
// personal address (not the company one — this is a personal-finance event,
// not a work notification), and in-app-notifies their User account.
async function markSalaryPaid(id, transactionDetails, actingUser) {
  const existing = await salarySlipRepository.findById(id);
  if (!existing) throw ApiError.notFound('Salary slip not found');
  if (existing.paymentStatus === 'paid') throw ApiError.conflict('This salary slip is already marked paid');

  const slip = await salarySlipRepository.markPaid(id, { paidBy: actingUser.id, transactionDetails });

  if (slip.employee?.personalEmail) {
    await emailService
      .sendEmail({
        to: slip.employee.personalEmail,
        subject: 'Your salary has been paid',
        html: salaryPaidEmailHtml(slip, transactionDetails),
        from: financeFrom(),
      })
      .catch(() => {});
  }

  const employeeUser = await userRepository.findByEmployeeId(slip.employee._id);
  if (employeeUser) {
    await notificationService.createForUsers([employeeUser._id], {
      type: NOTIFICATION_TYPES.SALARY_SLIP_PAID,
      title: 'Salary paid',
      message: `Your salary for ${slip.startDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })} – ${slip.endDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })} has been paid.`,
      employee: slip.employee._id,
    });
  }

  return slip;
}

module.exports = {
  renderMasterSheet,
  renderSlip,
  buildMasterSheet,
  generateSlip,
  generateBulkSlips,
  buildBulkZip,
  listForEmployee,
  getFilePath,
  listRecentMonthsForEmployee,
  getOwnFilePath,
  listDueForFinance,
  markSalaryPaid,
};
