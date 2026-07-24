const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireRole } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');
const companyEventValidator = require('../validators/companyEvent.validator');
const companyEventController = require('../controllers/companyEvent.controller');

const router = Router();

// Open to any logged-in user — the company calendar needs this for
// everyone, not just admins/HR (same convention as holidays).
router.get('/', validate(companyEventValidator.list), companyEventController.list);
router.post(
  '/',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.HR),
  validate(companyEventValidator.create),
  companyEventController.create
);
router.delete(
  '/:id',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.HR),
  validate(companyEventValidator.remove),
  companyEventController.remove
);

module.exports = router;
