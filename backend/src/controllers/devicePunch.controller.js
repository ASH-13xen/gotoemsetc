const asyncHandler = require('../utils/asyncHandler');
const devicePunchService = require('../services/devicePunch.service');

// `date` is a plain 'YYYY-MM-DD' — expanded into that whole UTC day so the
// calendar day-popover can pull exactly the scans that fed a given day's
// attendance status.
const list = asyncHandler(async (req, res) => {
  const { limit, employeeId, date } = req.query;
  let from;
  let to;
  if (date) {
    from = new Date(`${date}T00:00:00.000Z`);
    to = new Date(`${date}T23:59:59.999Z`);
  }
  const punches = await devicePunchService.listRecent({
    limit: limit ? Number(limit) : undefined,
    employeeId,
    from,
    to,
  });
  res.json({ punches });
});

module.exports = { list };
