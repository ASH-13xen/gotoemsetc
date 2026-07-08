const fs = require('node:fs/promises');
const path = require('node:path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'salary', 'salary-slip-template.pdf');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatCurrency(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDateDDMMYYYY(date) {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${date.getUTCFullYear()}`;
}

// Small numeric/text cells that already print a "0"/"Zero"/"₹0.00" placeholder
// in the blank template need it painted over before the real value is drawn.
function whiteoutAndDraw(page, font, text, x, y, { size = 8, boxWidth = 70, boxHeight = 10, color = rgb(0, 0, 0), whiteout = true } = {}) {
  if (whiteout) {
    // Original placeholder glyphs ("0"/"Zero"/"₹0.00") can start a couple of
    // points left/below our own draw position — pad generously on every
    // side so no sliver of the old glyph survives.
    page.drawRectangle({ x: x - 6, y: y - 4, width: boxWidth, height: boxHeight + 4, color: rgb(1, 1, 1) });
  }
  page.drawText(String(text ?? ''), { x, y, size, font, color });
}

const STATUS_COLORS = {
  P: rgb(0.80, 0.95, 0.80),
  O: rgb(0.78, 0.88, 1.0),
  H: rgb(1.0, 0.95, 0.7),
  L: rgb(1.0, 0.85, 0.6),
  SL: rgb(1.0, 0.78, 0.78),
  W: rgb(0.88, 0.82, 1.0),
};
const OFF_DAY_COLOR = rgb(0.85, 0.85, 0.85);
const UNPAID_ABSENT_COLOR = rgb(1.0, 0.7, 0.7);

async function generateSalarySlipPdf({ employee, month, year, cutoffDate, summary, salary }) {
  const bytes = await fs.readFile(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.getPages()[0];

  const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
  const payDateThisSlip = employee.payDate
    ? new Date(Date.UTC(year, month - 1, Math.min(employee.payDate, 28)))
    : null;

  // NOTE: coordinates were extracted with PyMuPDF, which measures from the
  // TOP-left of the page. pdf-lib draws from the BOTTOM-left (PDF native
  // coordinate space), so every extracted y is converted via `pdfY(y)`.
  const PAGE_HEIGHT = 842;
  const pdfY = (topDownY) => PAGE_HEIGHT - topDownY - 7;

  // Header month/year line.
  whiteoutAndDraw(page, font, `Payslip for the month of ${MONTH_NAMES[month - 1]}, ${year}`, 246.8, pdfY(125), {
    size: 8, boxWidth: 160, boxHeight: 10,
  });

  // Employee info block — genuinely blank cells in the template, no whiteout needed.
  whiteoutAndDraw(page, font, employeeName, 140, pdfY(161), { whiteout: false });
  whiteoutAndDraw(page, font, employee.panNumber, 475, pdfY(161), { whiteout: false });
  whiteoutAndDraw(page, font, employee.designation, 140, pdfY(179), { whiteout: false });
  whiteoutAndDraw(page, font, employee.bankName, 475, pdfY(179), { whiteout: false });
  whiteoutAndDraw(page, font, employee.employeeCode, 140, pdfY(197), { whiteout: false });
  whiteoutAndDraw(page, font, employee.bankAccountNumber, 475, pdfY(197), { whiteout: false });
  whiteoutAndDraw(page, font, employee.dateOfJoining ? formatDateDDMMYYYY(new Date(employee.dateOfJoining)) : '', 140, pdfY(211), { whiteout: false });
  whiteoutAndDraw(page, font, employee.bankIFSC, 475, pdfY(215), { whiteout: false });
  whiteoutAndDraw(page, font, String(summary.daysWorkedTotal), 475, pdfY(250), { whiteout: false });
  whiteoutAndDraw(page, font, payDateThisSlip ? formatDateDDMMYYYY(payDateThisSlip) : '', 140, pdfY(268), { whiteout: false });
  whiteoutAndDraw(page, font, String(summary.totalDaysInPeriod), 475, pdfY(268), { whiteout: false });

  // EARNINGS — Basic / Overtime (blank cells).
  whiteoutAndDraw(page, font, formatCurrency(salary.basicMaster), 175, pdfY(304), { whiteout: false });
  whiteoutAndDraw(page, font, formatCurrency(salary.basicEarnings), 263, pdfY(304), { whiteout: false });
  whiteoutAndDraw(page, font, formatCurrency(salary.otMaster), 175, pdfY(322), { whiteout: false });
  whiteoutAndDraw(page, font, formatCurrency(salary.otEarnings), 263, pdfY(322), { whiteout: false });

  // EARNINGS — manual-input rows (existing "0" placeholders, whiteout first).
  const earningRows = [
    [salary.compensationOff, 340],
    [salary.incentives, 358],
    [salary.travelAllowance, 376],
    [salary.otherEarning1, 394],
  ];
  for (const [value, topY] of earningRows) {
    whiteoutAndDraw(page, font, formatCurrency(value), 175, pdfY(topY), { boxWidth: 20, boxHeight: 9 });
    whiteoutAndDraw(page, font, formatCurrency(value), 263, pdfY(topY), { boxWidth: 20, boxHeight: 9 });
  }

  // DEDUCTIONS (existing "0" placeholders).
  const deductionRows = [
    [salary.incomeTaxDeduction, 304],
    [salary.professionTax, 322],
    [salary.pf, 340],
    [salary.halfDayDeductions, 358],
    [salary.unpaidOffDeductions, 376],
    [salary.otherDeduction3, 394],
  ];
  for (const [value, topY] of deductionRows) {
    whiteoutAndDraw(page, font, formatCurrency(value), 508, pdfY(topY), { boxWidth: 20, boxHeight: 9 });
  }

  // Gross Earnings / Total Deductions.
  whiteoutAndDraw(page, boldFont, formatCurrency(salary.grossEarnings), 219, pdfY(447), { boxWidth: 30, boxHeight: 9 });
  whiteoutAndDraw(page, boldFont, formatCurrency(salary.totalDeductions), 508, pdfY(447), { boxWidth: 20, boxHeight: 9 });

  // REIMBURSEMENTS.
  whiteoutAndDraw(page, font, formatCurrency(salary.reimbursement1), 175, pdfY(483), { boxWidth: 20, boxHeight: 9 });
  whiteoutAndDraw(page, font, formatCurrency(salary.reimbursement1), 263, pdfY(483), { boxWidth: 20, boxHeight: 9 });
  whiteoutAndDraw(page, font, formatCurrency(salary.reimbursement2), 175, pdfY(501), { boxWidth: 20, boxHeight: 9 });
  whiteoutAndDraw(page, font, formatCurrency(salary.reimbursement2), 263, pdfY(501), { boxWidth: 20, boxHeight: 9 });
  whiteoutAndDraw(page, boldFont, formatCurrency(salary.totalReimbursements), 263, pdfY(519), { boxWidth: 20, boxHeight: 9 });

  // NETPAY AMOUNT.
  whiteoutAndDraw(page, font, formatCurrency(salary.grossEarnings), 470, pdfY(555), { boxWidth: 30, boxHeight: 9 });
  whiteoutAndDraw(page, font, formatCurrency(salary.totalDeductions), 470, pdfY(573), { boxWidth: 30, boxHeight: 9 });
  whiteoutAndDraw(page, font, formatCurrency(salary.totalReimbursements), 470, pdfY(591), { boxWidth: 30, boxHeight: 9 });
  whiteoutAndDraw(page, boldFont, `Rs. ${(Number(salary.netPayable) || 0).toFixed(2)}`, 448, pdfY(609), {
    size: 9, boxWidth: 55, boxHeight: 10,
  });
  whiteoutAndDraw(page, font, salary.netPayableWords, 179, pdfY(626), { boxWidth: 360, boxHeight: 10 });

  appendAttendanceCalendarPage(pdfDoc, font, boldFont, { employee, employeeName, month, year, summary });

  return Buffer.from(await pdfDoc.save());
}

function appendAttendanceCalendarPage(pdfDoc, font, boldFont, { employeeName, month, year, summary }) {
  const page = pdfDoc.addPage([595, 842]);
  const marginX = 40;
  const gridWidth = 595 - marginX * 2;
  const colWidth = gridWidth / 7;

  page.drawText('Attendance Summary', { x: marginX, y: 800, size: 16, font: boldFont });
  page.drawText(`${employeeName} — ${MONTH_NAMES[month - 1]} ${year} (through day ${summary.totalDaysInPeriod})`, {
    x: marginX, y: 782, size: 10, font,
  });

  const weekdayHeaders = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const headerY = 755;
  weekdayHeaders.forEach((label, i) => {
    page.drawText(label, { x: marginX + i * colWidth + 4, y: headerY, size: 9, font: boldFont });
  });

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cellHeight = 46;
  const gridTop = headerY - 10;

  const holidayKeys = new Set(summary.holidays.map((h) => h.date.toISOString().slice(0, 10)));
  const recordByDate = new Map(summary.records.map((r) => [r.date.toISOString().slice(0, 10), r]));

  for (let day = 1; day <= summary.totalDaysInPeriod; day += 1) {
    const cellIndex = firstWeekday + (day - 1);
    const row = Math.floor(cellIndex / 7);
    const col = cellIndex % 7;
    const x = marginX + col * colWidth;
    const y = gridTop - row * cellHeight - cellHeight;

    const date = new Date(Date.UTC(year, month - 1, day));
    const dateKey = date.toISOString().slice(0, 10);
    const record = recordByDate.get(dateKey);
    const isSunday = col === 0;
    const isHoliday = holidayKeys.has(dateKey);
    const isOff = isSunday || isHoliday;

    let bgColor = rgb(1, 1, 1);
    if (record?.status) bgColor = STATUS_COLORS[record.status] || bgColor;
    else if (isOff) bgColor = OFF_DAY_COLOR;
    else if (!record) bgColor = UNPAID_ABSENT_COLOR; // working day, nothing logged at all

    page.drawRectangle({
      x, y, width: colWidth, height: cellHeight,
      color: bgColor, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5,
    });
    page.drawText(String(day), { x: x + 3, y: y + cellHeight - 12, size: 8, font });

    if (record?.status) {
      page.drawText(record.status, { x: x + 4, y: y + 6, size: 14, font: boldFont });
    } else if (isHoliday) {
      page.drawText('HOL', { x: x + 4, y: y + 6, size: 8, font });
    }
    if (record?.overtimeHours) {
      page.drawText(`+${record.overtimeHours}h OT`, { x: x + colWidth - 42, y: y + 4, size: 6.5, font });
    }
  }

  const lastRow = Math.floor((firstWeekday + summary.totalDaysInPeriod - 1) / 7);
  let legendY = gridTop - (lastRow + 1) * cellHeight - 24;

  const legendItems = [
    ['P', 'Full Day Present'], ['O', 'Paid Leave'], ['H', 'Half Day'],
    ['L', 'Late'], ['SL', 'Short Leave'], ['W', 'Work From Home'],
  ];
  page.drawText('Legend:', { x: marginX, y: legendY, size: 9, font: boldFont });
  legendItems.forEach(([code, label], i) => {
    const lx = marginX + 55 + i * 82;
    page.drawRectangle({ x: lx, y: legendY - 2, width: 8, height: 8, color: STATUS_COLORS[code] });
    page.drawText(`${code} = ${label}`, { x: lx + 11, y: legendY, size: 7.5, font });
  });

  legendY -= 24;
  const { counts } = summary;
  const summaryLines = [
    `Full Day Present (P): ${counts.P}`,
    `Paid Leave (O): ${counts.O}`,
    `Half Day (H): ${counts.H}`,
    `Late (L): ${counts.L}`,
    `Short Leave (SL): ${counts.SL}`,
    `Work From Home (W): ${counts.W}`,
    `Total Overtime Hours: ${summary.totalOvertimeHours}`,
    `Working Days in Period: ${summary.workingDaysInPeriod}`,
    `Off Days (Sundays/Holidays): ${summary.totalDaysInPeriod - summary.workingDaysInPeriod}`,
    `Unpaid Absent Days: ${summary.unpaidAbsentDays}`,
    `Days Worked (for pay): ${summary.daysWorkedTotal}`,
  ];
  page.drawText('Summary:', { x: marginX, y: legendY, size: 9, font: boldFont });
  summaryLines.forEach((line, i) => {
    page.drawText(line, { x: marginX, y: legendY - 16 - i * 14, size: 8.5, font });
  });
}

module.exports = { generateSalarySlipPdf };
