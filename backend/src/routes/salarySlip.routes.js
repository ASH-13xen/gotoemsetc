const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/multer.middleware');
const { requirePermission, requireHrWorkAccess, requireFinanceAccess, requireAccess } = require('../middlewares/auth.middleware');
const { ACCESS } = require('../config/access');
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
router.get(
  '/finance/master-sheet',
  requireFinanceAccess(),
  validate(salarySlipValidator.masterSheet),
  salarySlipController.downloadFinanceMasterSheet
);
router.get('/finance/:id/file', requireFinanceAccess(), validate(salarySlipValidator.getOrDelete), salarySlipController.downloadFinanceFile);
// multipart: the transaction details as fields plus Finance's receipt as
// `receipt` (required).
router.post(
  '/:id/mark-paid',
  requireFinanceAccess(),
  upload.single('receipt'),
  validate(salarySlipValidator.markPaid),
  salarySlipController.markPaid
);

// Generated slips waiting for the CEO/admin — see salaryBatch.service.js.
router.get('/batches', requireAccess(ACCESS.PAYOUT_APPROVAL), salarySlipController.listBatches);
router.post(
  '/batches/:id/approve',
  requireAccess(ACCESS.PAYOUT_APPROVAL),
  validate(salarySlipValidator.batchDecision),
  salarySlipController.approveBatch
);
router.post(
  '/batches/:id/send-back',
  requireAccess(ACCESS.PAYOUT_APPROVAL),
  validate(salarySlipValidator.batchSendBack),
  salarySlipController.sendBackBatch
);

// An employee's own "salary paid" notice, and Finance's receipt for it.
router.get('/mine/paid-unseen', salarySlipController.listPaidUnseen);
router.post('/:id/paid-seen', validate(salarySlipValidator.getOrDelete), salarySlipController.markPaidSeen);
router.get('/:id/payment-receipt', validate(salarySlipValidator.getOrDelete), salarySlipController.downloadPaymentReceipt);

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
