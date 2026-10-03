const asyncHandler = require('../utils/asyncHandler');
const inventoryReportService = require('../services/inventoryReport.service');

// One row per categorized inventory item (not one per employee) — see
// inventoryReport.service.js#listInventory.
const list = asyncHandler(async (req, res) => {
  const items = await inventoryReportService.listInventory();
  res.json({ items });
});

module.exports = { list };
