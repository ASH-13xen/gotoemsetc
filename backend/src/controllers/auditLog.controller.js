const asyncHandler = require('../utils/asyncHandler');
const auditLogService = require('../services/auditLog.service');

const list = asyncHandler(async (req, res) => {
  const result = await auditLogService.list(req.query);
  res.json(result);
});

module.exports = { list };
