const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requirePermission, requireHrWorkAccess, requireFinanceAccess } = require('../middlewares/auth.middleware');
const { PERMISSIONS } = require('../config/constants');
const salarySlipValidator = require('../validators/salarySlip.validator');
const salarySlipController = require('../controllers/salarySlip.controller');

const router = Router();

// Finance section — admin/ceo/account_manager. Mounted ahead of the
// permission-gated /:id/file route below since "finance" would otherwise be
// captured by that route's :id param.
router.get(
  '/finance',
  requireFinanceAccess(),
  validate(salarySlipValidator.listForFinance),
  salarySlipController.listForFinance
);
router.post(
  '/:id/mark-paid',
  requireFinanceAccess(),
  validate(salarySlipValidator.markPaid),
  salarySlipController.markPaid
);

router.get(
  '/:id/file',
  requirePermission(PERMISSIONS.VIEW_SALARY_SLIP),
  validate(salarySlipValidator.getOrDelete),
  salarySlipController.downloadFile
);

router.post(
  '/generate-bulk',
  requireHrWorkAccess(),
  validate(salarySlipValidator.generateBulk),
  salarySlipController.generateBulk
);

router.post(
  '/bulk-zip',
  requireHrWorkAccess(),
  validate(salarySlipValidator.bulkZip),
  salarySlipController.downloadBulkZip
);

module.exports = router;
