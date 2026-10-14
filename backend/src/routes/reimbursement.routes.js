const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/multer.middleware');
const { requireFinanceAccess, requireAccess } = require('../middlewares/auth.middleware');
const { ACCESS } = require('../config/access');
const reimbursementValidator = require('../validators/reimbursement.validator');
const reimbursementController = require('../controllers/reimbursement.controller');

const router = Router();

// Any employee can file and browse their own — same baseline-access shape
// as complaint.routes.js.
// multipart: the claim's fields plus its receipt as `receipt` (required).
router.post('/', upload.single('receipt'), validate(reimbursementValidator.file), reimbursementController.file);
router.get('/mine', reimbursementController.listMine);
router.post('/:id/receipt', upload.single('receipt'), reimbursementController.uploadReceipt);
router.get('/:id/receipt', validate({ params: reimbursementValidator.idParam }), reimbursementController.downloadReceipt);

// Approve/reject is Finance (admin/ceo/cfo/finance) — same audience as
// listing everyone's claims and marking paid below, so anyone who can see
// the queue can also act on it.
router.post(
  '/:id/approve',
  requireFinanceAccess(),
  validate({ params: reimbursementValidator.idParam }),
  reimbursementController.approve
);
router.post(
  '/:id/reject',
  requireFinanceAccess(),
  validate(reimbursementValidator.reject),
  reimbursementController.reject
);

// Listing everyone's claims and marking paid is Finance (admin/ceo/cfo/finance).
router.get(
  '/:id/payment-proof',
  validate({ params: reimbursementValidator.idParam }),
  reimbursementController.downloadPaymentProof
);
router.post('/:id/acknowledge', validate(reimbursementValidator.acknowledge), reimbursementController.acknowledge);

// The CEO's/admin's final approval, after Finance's.
router.get('/awaiting-ceo', requireAccess(ACCESS.PAYOUT_APPROVAL), reimbursementController.listAwaitingCeo);
router.post(
  '/:id/ceo-approve',
  requireAccess(ACCESS.PAYOUT_APPROVAL),
  validate({ params: reimbursementValidator.idParam }),
  reimbursementController.ceoApprove
);
router.post(
  '/:id/ceo-reject',
  requireAccess(ACCESS.PAYOUT_APPROVAL),
  validate(reimbursementValidator.reject),
  reimbursementController.ceoReject
);

router.get('/', requireFinanceAccess(), validate(reimbursementValidator.list), reimbursementController.listAll);
// multipart: the transaction details as fields plus the payment screenshot
// as `proof`.
router.post(
  '/:id/mark-paid',
  requireFinanceAccess(),
  upload.single('proof'),
  validate(reimbursementValidator.markPaid),
  reimbursementController.markPaid
);

module.exports = router;
