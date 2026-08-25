const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const attendanceValidator = require('../validators/attendance.validator');
const attendanceController = require('../controllers/attendance.controller');

const router = Router();

// Mounted at /attendance, gated requireHrWorkAccess() at the mount point in
// routes/index.js — org-wide, unlike everything else attendance-related
// (which is nested under /employees/:id/attendance*).
router.get('/monthly-overview', validate(attendanceValidator.monthlyOverview), attendanceController.monthlyOverview);

module.exports = router;
