const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAccess, requirePermission } = require('../middlewares/auth.middleware');
const { PERMISSIONS } = require('../config/constants');
const { ACCESS } = require('../config/access');
const userValidator = require('../validators/user.validator');
const userController = require('../controllers/user.controller');

const router = Router();

// Listing every credential system-wide, and viewing/revoking one by its raw
// user id, stay strictly admin-only — add_credentials only ever grants the
// narrower per-employee lookup/create/update below.
router.get('/', requireAccess(ACCESS.EMS_ALL), userController.list);
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
router.get('/:id', requireAccess(ACCESS.EMS_ALL), validate(userValidator.getById), userController.getById);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ADD_CREDENTIALS),
  validate(userValidator.updateCredential),
  userController.updateCredential
);
router.delete('/:id', requireAccess(ACCESS.EMS_ALL), validate(userValidator.removeCredential), userController.removeCredential);

module.exports = router;
