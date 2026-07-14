const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireTaskClientAccess } = require('../middlewares/clientAccess.middleware');
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

router.get('/:id/messages', validate(taskValidator.listMessages), requireTaskClientAccess(), taskController.listMessages);
router.post('/:id/messages', validate(taskValidator.postMessage), requireTaskClientAccess(), taskController.postMessage);

module.exports = router;
