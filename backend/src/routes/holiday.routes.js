const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireHrWorkAccess } = require('../middlewares/auth.middleware');
const holidayValidator = require('../validators/holiday.validator');
const holidayController = require('../controllers/holiday.controller');

const router = Router();

// Open to any logged-in user — the attendance calendar needs this to grey
// out off-days for everyone, not just admins.
router.get('/', validate(holidayValidator.list), holidayController.list);
router.post('/', requireHrWorkAccess(), validate(holidayValidator.create), holidayController.create);
router.delete('/:id', requireHrWorkAccess(), validate(holidayValidator.remove), holidayController.remove);

module.exports = router;
