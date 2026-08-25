const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const companyCalendarValidator = require('../validators/companyCalendar.validator');
const companyCalendarController = require('../controllers/companyCalendar.controller');

const router = Router();

// Open to any logged-in user — the company calendar's "who's out" layer
// needs this for everyone, same convention as holidays/company events.
router.get('/', validate(companyCalendarValidator.list), companyCalendarController.list);

module.exports = router;
