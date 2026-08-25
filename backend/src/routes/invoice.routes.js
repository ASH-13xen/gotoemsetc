const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireRole, requireFinanceAccess } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');
const invoiceValidator = require('../validators/invoice.validator');
const invoiceController = require('../controllers/invoice.controller');

const router = Router();

router.use(requireFinanceAccess());

router.get('/plan-prices', invoiceController.listPlanPrices);
router.put(
  '/plan-prices',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.CEO),
  validate(invoiceValidator.setPlanPrices),
  invoiceController.setPlanPrices
);

router.get('/summary', validate(invoiceValidator.summary), invoiceController.summary);
router.get('/', validate(invoiceValidator.list), invoiceController.list);
router.post(
  '/generate',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.CEO),
  validate(invoiceValidator.generate),
  invoiceController.generate
);
router.get('/:id/pdf', validate({ params: invoiceValidator.idParam }), invoiceController.downloadPdf);
router.post(
  '/:id/approve',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.CEO),
  validate({ params: invoiceValidator.idParam }),
  invoiceController.approve
);
router.post('/:id/mark-paid', validate(invoiceValidator.markPaid), invoiceController.markPaid);

module.exports = router;
