const asyncHandler = require('../utils/asyncHandler');
const attendanceService = require('../services/attendance.service');

// Open to any authenticated user — see companyCalendar.routes.js.
const list = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const entries = await attendanceService.listWhosOutForMonth({ month, year });
  res.json({ entries });
});

module.exports = { list };
