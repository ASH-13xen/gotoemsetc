const asyncHandler = require('../utils/asyncHandler');
const attendanceWarningService = require('../services/attendanceWarning.service');
const { ATTENDANCE_WARNING_TEMPLATES } = require('../config/constants');

const dailyReport = asyncHandler(async (req, res) => {
  const report = await attendanceWarningService.computeDailyReport({ date: req.query.date });
  res.json({ report, templates: ATTENDANCE_WARNING_TEMPLATES });
});

const send = asyncHandler(async (req, res) => {
  const warning = await attendanceWarningService.sendWarning({
    employeeId: req.body.employeeId,
    date: req.body.date,
    category: req.body.category,
    message: req.body.message,
    sentByUserId: req.user.id,
  });
  req.auditContext = {
    action: 'attendanceWarning.send',
    resourceType: 'AttendanceWarning',
    resourceId: warning._id,
    metadata: { employeeId: req.body.employeeId, category: req.body.category, date: req.body.date },
  };
  res.status(201).json({ warning });
});

const monthly = asyncHandler(async (req, res) => {
  const result = await attendanceWarningService.getMonthlyCounts(req.params.employeeId, {
    year: req.query.year,
    month: req.query.month,
  });
  res.json(result);
});

const pending = asyncHandler(async (req, res) => {
  const warnings = await attendanceWarningService.listPendingWarningsForUser(req.user);
  res.json({ warnings });
});

module.exports = { dailyReport, send, monthly, pending };
