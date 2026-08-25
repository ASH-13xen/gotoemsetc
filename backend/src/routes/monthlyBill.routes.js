const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireRole, requireBillsAccess } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');
const monthlyBillValidator = require('../validators/monthlyBill.validator');
const monthlyBillController = require('../controllers/monthlyBill.controller');

const router = Router();

// Self-scoped to whatever unread reminder notifications the caller actually
// has — no access gate needed beyond being authenticated (verifyToken, at
// the router mount in routes/index.js). Backs the frontendall dashboard's
// reminder modal.
router.get('/reminders/mine', monthlyBillController.pendingReminders);

// Creating/pausing bill templates is admin/ceo only, per spec — narrower
// than requireBillsAccess below, which additionally covers viewing the list
// and marking an instance paid (finance, operations, admin, or ceo).
router.post(
  '/',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.CEO),
  validate(monthlyBillValidator.create),
  monthlyBillController.create
);
router.patch(
  '/:id/active',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.CEO),
  validate(monthlyBillValidator.setActive),
  monthlyBillController.setActive
);

router.get('/', requireBillsAccess(), monthlyBillController.list);
router.post(
  '/:id/instances/:instanceId/mark-paid',
  requireBillsAccess(),
  validate(monthlyBillValidator.markPaid),
  monthlyBillController.markPaid
);

module.exports = router;
