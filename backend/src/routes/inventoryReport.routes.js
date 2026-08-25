const { Router } = require('express');
const inventoryReportController = require('../controllers/inventoryReport.controller');

const router = Router();

// Mounted at /inventory-report, gated requireHrWorkAccess() at the mount
// point in routes/index.js — org-wide, not nested under /employees/:id.
router.get('/', inventoryReportController.list);

module.exports = router;
