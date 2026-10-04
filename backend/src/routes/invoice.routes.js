const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAccess, requireFinanceAccess } = require('../middlewares/auth.middleware');
const { ACCESS } = require('../config/access');
const invoiceValidator = require('../validators/invoice.validator');
const invoiceController = require('../controllers/invoice.controller');

const router = Router();

router.use(requireFinanceAccess());

router.get('/plan-prices', invoiceController.listPlanPrices);
router.put(
  '/plan-prices',
  requireAccess(ACCESS.FINANCE_APPROVE),
  validate(invoiceValidator.setPlanPrices),
  invoiceController.setPlanPrices
);

router.get('/summary', validate(invoiceValidator.summary), invoiceController.summary);
router.get('/', validate(invoiceValidator.list), invoiceController.list);
router.post(
  '/generate',
  requireAccess(ACCESS.FINANCE_APPROVE),
  validate(invoiceValidator.generate),
  invoiceController.generate
);
router.get('/:id/pdf', validate({ params: invoiceValidator.idParam }), invoiceController.downloadPdf);
router.post(
  '/:id/approve',
  requireAccess(ACCESS.FINANCE_APPROVE),
  validate({ params: invoiceValidator.idParam }),
  invoiceController.approve
);
router.post('/:id/mark-paid', validate(invoiceValidator.markPaid), invoiceController.markPaid);

module.exports = router;
