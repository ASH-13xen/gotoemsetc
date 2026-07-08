const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireRole } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');
const salarySlipValidator = require('../validators/salarySlip.validator');
const salarySlipController = require('../controllers/salarySlip.controller');

const router = Router();

router.get(
  '/:id/file',
  requireRole(USER_ROLES.ADMIN),
  validate(salarySlipValidator.getOrDelete),
  salarySlipController.downloadFile
);

module.exports = router;
