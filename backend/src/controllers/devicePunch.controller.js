const asyncHandler = require('../utils/asyncHandler');
const devicePunchService = require('../services/devicePunch.service');

const list = asyncHandler(async (req, res) => {
  const { limit, employeeId } = req.query;
  const punches = await devicePunchService.listRecent({
    limit: limit ? Number(limit) : undefined,
    employeeId,
  });
  res.json({ punches });
});

module.exports = { list };
