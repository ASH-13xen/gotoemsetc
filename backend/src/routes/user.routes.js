const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireRole, requirePermission } = require('../middlewares/auth.middleware');
const { USER_ROLES, PERMISSIONS } = require('../config/constants');
const userValidator = require('../validators/user.validator');
const userController = require('../controllers/user.controller');

const router = Router();

// Listing every credential system-wide, and viewing/revoking one by its raw
// user id, stay strictly admin-only — add_credentials only ever grants the
// narrower per-employee lookup/create/update below.
router.get('/', requireRole(USER_ROLES.ADMIN, USER_ROLES.HR), userController.list);
router.get(
  '/by-employee/:employeeId',
  requirePermission(PERMISSIONS.ADD_CREDENTIALS),
  validate(userValidator.getByEmployeeId),
  userController.getForEmployee
);
router.post(
  '/by-employee/:employeeId',
  requirePermission(PERMISSIONS.ADD_CREDENTIALS),
  validate(userValidator.createCredential),
  userController.createForEmployee
);
router.get('/:id', requireRole(USER_ROLES.ADMIN, USER_ROLES.HR), validate(userValidator.getById), userController.getById);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ADD_CREDENTIALS),
  validate(userValidator.updateCredential),
  userController.updateCredential
);
router.delete('/:id', requireRole(USER_ROLES.ADMIN, USER_ROLES.HR), validate(userValidator.removeCredential), userController.removeCredential);

module.exports = router;
