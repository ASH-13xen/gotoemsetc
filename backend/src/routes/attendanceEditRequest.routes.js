const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireRole } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');
const v = require('../validators/attendanceEditRequest.validator');
const c = require('../controllers/attendanceEditRequest.controller');

// HR files requests to change attendance older than 2 days; only the CEO and
// admin see and decide them (HR sees just their own, to know the outcome).
const router = Router();

router.get('/', requireRole(USER_ROLES.ADMIN, USER_ROLES.CEO, USER_ROLES.HR), validate(v.list), c.list);
router.post('/', requireRole(USER_ROLES.HR), validate(v.create), c.create);
router.post('/:id/approve', requireRole(USER_ROLES.ADMIN, USER_ROLES.CEO), validate(v.decide), c.approve);
router.post('/:id/reject', requireRole(USER_ROLES.ADMIN, USER_ROLES.CEO), validate(v.decide), c.reject);

module.exports = router;
