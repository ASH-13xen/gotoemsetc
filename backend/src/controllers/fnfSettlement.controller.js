const asyncHandler = require('../utils/asyncHandler');
const fnfSettlementService = require('../services/fnfSettlement.service');

const list = asyncHandler(async (req, res) => {
  const settlements = await fnfSettlementService.listAll();
  res.json({ settlements });
});

const markPaid = asyncHandler(async (req, res) => {
  const settlement = await fnfSettlementService.markPaid(req.params.id, req.body, req.user);
  req.auditContext = { action: 'fnfSettlement.markPaid', resourceType: 'FnfSettlement', resourceId: settlement._id };
  res.json({ settlement });
});

module.exports = { list, markPaid };
