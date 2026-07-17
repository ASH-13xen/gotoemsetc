const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requirePermission } = require('../middlewares/auth.middleware');
const { PERMISSIONS } = require('../config/constants');
const salarySlipValidator = require('../validators/salarySlip.validator');
const salarySlipController = require('../controllers/salarySlip.controller');

const router = Router();

router.get(
  '/:id/file',
  requirePermission(PERMISSIONS.VIEW_SALARY_SLIP),
  validate(salarySlipValidator.getOrDelete),
  salarySlipController.downloadFile
);

module.exports = router;
