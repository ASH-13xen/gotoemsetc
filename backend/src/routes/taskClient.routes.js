const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requirePermission } = require('../middlewares/auth.middleware');
const { PERMISSIONS } = require('../config/constants');
const upload = require('../middlewares/multer.middleware');
const taskClientValidator = require('../validators/taskClient.validator');
const taskClientController = require('../controllers/taskClient.controller');

const router = Router();

// Open to any logged-in employee — Client-related tasks need every employee
// to be able to see the client registry, even though only admin/HR or a
// manage_tasks holder can create/edit/delete clients or change their logo.
router.get('/', taskClientController.list);
router.get('/:id', validate(taskClientValidator.getOrDelete), taskClientController.get);
router.post(
  '/',
  requirePermission(PERMISSIONS.MANAGE_TASKS),
  validate(taskClientValidator.create),
  taskClientController.create
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.MANAGE_TASKS),
  validate(taskClientValidator.update),
  taskClientController.update
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.MANAGE_TASKS),
  validate(taskClientValidator.getOrDelete),
  taskClientController.remove
);
router.post(
  '/:id/logo',
  requirePermission(PERMISSIONS.MANAGE_TASKS),
  validate(taskClientValidator.getOrDelete),
  upload.single('logo'),
  taskClientController.uploadLogo
);

module.exports = router;
