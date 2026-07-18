const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireRole } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');
const holidayValidator = require('../validators/holiday.validator');
const holidayController = require('../controllers/holiday.controller');

const router = Router();

// Open to any logged-in user — the attendance calendar needs this to grey
// out off-days for everyone, not just admins.
router.get('/', validate(holidayValidator.list), holidayController.list);
router.post('/', requireRole(USER_ROLES.ADMIN, USER_ROLES.HR), validate(holidayValidator.create), holidayController.create);
router.delete('/:id', requireRole(USER_ROLES.ADMIN, USER_ROLES.HR), validate(holidayValidator.remove), holidayController.remove);

module.exports = router;
