const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAccess, requireRole } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');
const { ACCESS } = require('../config/access');
const v = require('../validators/attendanceEditRequest.validator');
const c = require('../controllers/attendanceEditRequest.controller');

// HR files requests to change attendance older than 2 days; only the CEO and
// admin see and decide them (HR sees just their own, to know the outcome).
const router = Router();

router.get('/', requireAccess(ACCESS.HRMS, ACCESS.ATTENDANCE_FINAL_APPROVAL), validate(v.list), c.list);
router.post('/', requireRole(USER_ROLES.HR), validate(v.create), c.create);
router.post('/:id/approve', requireAccess(ACCESS.ATTENDANCE_FINAL_APPROVAL), validate(v.decide), c.approve);
router.post('/:id/reject', requireAccess(ACCESS.ATTENDANCE_FINAL_APPROVAL), validate(v.decide), c.reject);

module.exports = router;
