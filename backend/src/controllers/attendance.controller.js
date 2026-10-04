const asyncHandler = require('../utils/asyncHandler');
const attendanceService = require('../services/attendance.service');
const accessService = require('../services/access.service');

// Who changed a day by hand — only for them and the people above them.
const ATTRIBUTION = [{ by: 'markedBy', as: 'markedAs' }];

const mark = asyncHandler(async (req, res) => {
  const { date, status, overtimeMinutes, isLate, earlyDeparture, paidLeaveAwarded, notes } = req.body;
  const record = await attendanceService.markAttendance(
    req.params.id,
    date,
    { status, overtimeMinutes, isLate, earlyDeparture, paidLeaveAwarded, notes },
    req.user
  );
  res.status(201).json({ record });
});

const listForEmployee = asyncHandler(async (req, res) => {
  const records = await attendanceService.listForEmployee(req.params.id, req.query);
  res.json({ records: await accessService.shapeAttribution(req.user, records, ATTRIBUTION) });
});

const getSummary = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const summary = await attendanceService.computeLifetimeSummary(req.params.id, {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  res.json({ summary });
});

const markedToday = asyncHandler(async (req, res) => {
  const employeeIds = await attendanceService.listMarkedTodayEmployeeIds();
  res.json({ employeeIds });
});

// HR Work bulk tool (frontendhr) — org-wide monthly attendance overview.
const monthlyOverview = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const records = await attendanceService.getMonthlyOverview({ month, year });
  res.json({ records });
});

module.exports = { mark, listForEmployee, getSummary, markedToday, monthlyOverview };
