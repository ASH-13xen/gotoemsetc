const asyncHandler = require('../utils/asyncHandler');
const attendanceService = require('../services/attendance.service');

const mark = asyncHandler(async (req, res) => {
  const { date, status, overtimeHours, isLate, earlyDeparture, notes } = req.body;
  const record = await attendanceService.markAttendance(req.params.id, date, {
    status,
    overtimeHours,
    isLate,
    earlyDeparture,
    notes,
  });
  res.status(201).json({ record });
});

const listForEmployee = asyncHandler(async (req, res) => {
  const records = await attendanceService.listForEmployee(req.params.id, req.query);
  res.json({ records });
});

const getSummary = asyncHandler(async (req, res) => {
  const summary = await attendanceService.computeLifetimeSummary(req.params.id);
  res.json({ summary });
});

const markedToday = asyncHandler(async (req, res) => {
  const employeeIds = await attendanceService.listMarkedTodayEmployeeIds();
  res.json({ employeeIds });
});

module.exports = { mark, listForEmployee, getSummary, markedToday };
