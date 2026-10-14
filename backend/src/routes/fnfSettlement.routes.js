const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/multer.middleware');
const { requireFinanceAccess, requireAccess } = require('../middlewares/auth.middleware');
const { ACCESS } = require('../config/access');
const fnfSettlementValidator = require('../validators/fnfSettlement.validator');
const fnfSettlementController = require('../controllers/fnfSettlement.controller');

// Full & final settlement — HR confirms the last working day, the CEO/admin
// approves it with the final salary slip, Finance pays it with a receipt.
// See fnfSettlement.service.js.
const router = Router();

// HR (and the CEO/admin above them).
router.get('/hr', requireAccess(ACCESS.HRMS), fnfSettlementController.listForHr);
router.post('/:id/last-day', requireAccess(ACCESS.HRMS), validate(fnfSettlementValidator.confirmLastDay), fnfSettlementController.confirmLastDay);

// The CEO/admin.
router.get('/approvals', requireAccess(ACCESS.PAYOUT_APPROVAL), fnfSettlementController.listForApproval);
router.post('/:id/approve', requireAccess(ACCESS.PAYOUT_APPROVAL), validate(fnfSettlementValidator.decide), fnfSettlementController.approve);
router.post('/:id/send-back', requireAccess(ACCESS.PAYOUT_APPROVAL), validate(fnfSettlementValidator.sendBack), fnfSettlementController.sendBack);

// Files — each checks who is asking (HR, the CEO/admin, Finance; the
// receipt also the employee).
router.get('/:id/document', validate(fnfSettlementValidator.byId), fnfSettlementController.downloadDocument);
router.get('/:id/slip', validate(fnfSettlementValidator.byId), fnfSettlementController.downloadSlip);
router.get('/:id/payment-receipt', validate(fnfSettlementValidator.byId), fnfSettlementController.downloadReceipt);

// Finance.
router.get('/', requireFinanceAccess(), fnfSettlementController.list);
router.post('/:id/mark-paid', requireFinanceAccess(), upload.single('receipt'), validate(fnfSettlementValidator.markPaid), fnfSettlementController.markPaid);

module.exports = router;
