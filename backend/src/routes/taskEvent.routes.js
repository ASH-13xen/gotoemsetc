const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requirePermission } = require('../middlewares/auth.middleware');
const { PERMISSIONS } = require('../config/constants');
const taskEventValidator = require('../validators/taskEvent.validator');
const taskEventController = require('../controllers/taskEvent.controller');

const router = Router();

// Open to any logged-in employee — Event-related tasks need every employee
// to see the event registry, even though only admin/HR or a manage_tasks
// holder can create/edit/delete events.
router.get('/', taskEventController.list);
router.get('/:id', validate(taskEventValidator.getOrDelete), taskEventController.get);
router.post(
  '/',
  requirePermission(PERMISSIONS.MANAGE_TASKS),
  validate(taskEventValidator.create),
  taskEventController.create
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.MANAGE_TASKS),
  validate(taskEventValidator.update),
  taskEventController.update
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.MANAGE_TASKS),
  validate(taskEventValidator.getOrDelete),
  taskEventController.remove
);

module.exports = router;
