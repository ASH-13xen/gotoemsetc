const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requirePermission, requireHrWorkAccess, requireFinanceAccess } = require('../middlewares/auth.middleware');
const { PERMISSIONS } = require('../config/constants');
const salarySlipValidator = require('../validators/salarySlip.validator');
const salarySlipController = require('../controllers/salarySlip.controller');

const router = Router();

// Finance section — admin/ceo/cfo/finance. Mounted ahead of the
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

// Who would get a slip for this month — shown before bulk generation so HR
// can enter amounts for anyone first.
router.get(
  '/bulk-preview',
  requireHrWorkAccess(),
  validate(salarySlipValidator.bulkPreview),
  salarySlipController.bulkPreview
);

router.post(
  '/generate-bulk',
  requireHrWorkAccess(),
  validate(salarySlipValidator.generateBulk),
  salarySlipController.generateBulk
);

router.get(
  '/master-sheet',
  requireHrWorkAccess(),
  validate(salarySlipValidator.masterSheet),
  salarySlipController.downloadMasterSheet
);

router.post(
  '/bulk-zip',
  requireHrWorkAccess(),
  validate(salarySlipValidator.bulkZip),
  salarySlipController.downloadBulkZip
);

module.exports = router;
