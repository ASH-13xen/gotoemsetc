const asyncHandler = require('../utils/asyncHandler');
const inventoryReportService = require('../services/inventoryReport.service');

const list = asyncHandler(async (req, res) => {
  const employees = await inventoryReportService.listInventory();
  res.json({ employees });
});

module.exports = { list };
