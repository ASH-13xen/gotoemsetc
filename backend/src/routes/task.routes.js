const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireTaskClientAccess } = require('../middlewares/clientAccess.middleware');
const { requireRole } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');
const taskValidator = require('../validators/task.validator');
const taskController = require('../controllers/task.controller');

const router = Router();

// Cross-client aggregate views — self-filtered to accessible clients inside
// the service, so no per-route access middleware needed here.
router.get('/dashboard', taskController.dashboard);
router.get('/workload', taskController.workloadSummary);
router.get('/workload/:employeeId', validate(taskValidator.workloadForEmployee), taskController.workloadForEmployee);
router.get('/calendar', validate(taskValidator.contentCalendar), taskController.contentCalendar);

router.get('/:id', validate(taskValidator.getById), requireTaskClientAccess(), taskController.getById);
router.patch(
  '/:id/assignment',
  validate(taskValidator.updateAssignment),
  requireTaskClientAccess(),
  taskController.updateAssignment
);
router.patch(
  '/:id/steps/:stepId/assignment',
  validate(taskValidator.updateStepAssignment),
  requireTaskClientAccess(),
  taskController.updateStepAssignment
);
router.patch(
  '/:id/steps/:stepId/status',
  validate(taskValidator.updateStepStatus),
  requireTaskClientAccess(),
  taskController.updateStepStatus
);
router.post(
  '/:id/steps/:stepId/approval',
  validate(taskValidator.decideStepApproval),
  requireTaskClientAccess(),
  taskController.decideStepApproval
);
router.post(
  '/:id/attachments',
  validate(taskValidator.addAttachment),
  requireTaskClientAccess(),
  taskController.addAttachment
);
router.delete(
  '/:id/attachments/:attachmentIndex',
  validate(taskValidator.removeAttachment),
  requireTaskClientAccess(),
  taskController.removeAttachment
);
router.post('/:id/rollover', validate(taskValidator.rollover), requireTaskClientAccess(), taskController.rollover);

// --- Admin-only structural editing: steps, description, deletion ---
router.post(
  '/:id/steps',
  requireRole(USER_ROLES.ADMIN),
  validate(taskValidator.addStep),
  requireTaskClientAccess(),
  taskController.addStep
);
router.delete(
  '/:id/steps/:stepId',
  requireRole(USER_ROLES.ADMIN),
  validate(taskValidator.removeStep),
  requireTaskClientAccess(),
  taskController.removeStep
);
router.patch(
  '/:id/details',
  requireRole(USER_ROLES.ADMIN),
  validate(taskValidator.updateTaskDetails),
  requireTaskClientAccess(),
  taskController.updateTaskDetails
);
router.delete(
  '/:id',
  requireRole(USER_ROLES.ADMIN),
  validate(taskValidator.deleteTask),
  requireTaskClientAccess(),
  taskController.deleteTask
);

module.exports = router;
