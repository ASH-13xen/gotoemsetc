const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireRole } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');
const attendanceWarningValidator = require('../validators/attendanceWarning.validator');
const attendanceWarningController = require('../controllers/attendanceWarning.controller');

const router = Router();

// Any authenticated user — scoped to their own employeeLink inside the
// service, same pattern as /notifications.
router.get('/pending', attendanceWarningController.pending);

router.get(
  '/daily-report',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.HR, USER_ROLES.CEO),
  validate(attendanceWarningValidator.dailyReport),
  attendanceWarningController.dailyReport
);
router.post(
  '/',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.HR),
  validate(attendanceWarningValidator.send),
  attendanceWarningController.send
);
router.get(
  '/employee/:employeeId/monthly',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.HR),
  validate(attendanceWarningValidator.monthly),
  attendanceWarningController.monthly
);

module.exports = router;
