const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/multer.middleware');
const { requireRole, requireFinanceAccess } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');
const reimbursementValidator = require('../validators/reimbursement.validator');
const reimbursementController = require('../controllers/reimbursement.controller');

const router = Router();

// Any employee can file and browse their own — same baseline-access shape
// as complaint.routes.js.
router.post('/', validate(reimbursementValidator.file), reimbursementController.file);
router.get('/mine', reimbursementController.listMine);
router.post('/:id/receipt', upload.single('receipt'), reimbursementController.uploadReceipt);
router.get('/:id/receipt', validate({ params: reimbursementValidator.idParam }), reimbursementController.downloadReceipt);

// Approve/reject is CEO-only per spec.
router.post(
  '/:id/approve',
  requireRole(USER_ROLES.CEO),
  validate({ params: reimbursementValidator.idParam }),
  reimbursementController.approve
);
router.post(
  '/:id/reject',
  requireRole(USER_ROLES.CEO),
  validate(reimbursementValidator.reject),
  reimbursementController.reject
);

// Listing everyone's claims and marking paid is Finance (admin/ceo/account_manager).
router.get('/', requireFinanceAccess(), validate(reimbursementValidator.list), reimbursementController.listAll);
router.post(
  '/:id/mark-paid',
  requireFinanceAccess(),
  validate(reimbursementValidator.markPaid),
  reimbursementController.markPaid
);

module.exports = router;
