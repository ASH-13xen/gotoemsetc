const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAccess } = require('../middlewares/auth.middleware');
const { ACCESS } = require('../config/access');
const attendanceWarningValidator = require('../validators/attendanceWarning.validator');
const attendanceWarningController = require('../controllers/attendanceWarning.controller');

const router = Router();

// Any authenticated user — scoped to their own employeeLink inside the
// service, same pattern as /notifications.
router.get('/pending', attendanceWarningController.pending);

router.get(
  '/daily-report',
  requireAccess(ACCESS.HRMS),
  validate(attendanceWarningValidator.dailyReport),
  attendanceWarningController.dailyReport
);
router.post(
  '/',
  requireAccess(ACCESS.HRMS),
  validate(attendanceWarningValidator.send),
  attendanceWarningController.send
);
router.get(
  '/employee/:employeeId/monthly',
  requireAccess(ACCESS.HRMS),
  validate(attendanceWarningValidator.monthly),
  attendanceWarningController.monthly
);

module.exports = router;
