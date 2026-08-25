const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireUnifiedTaskViewAccess } = require('../middlewares/auth.middleware');
const {
  requireTaskAccess,
  requireCanCreateTopLevelTask,
  requireCanManageTask,
  requireCanUpdateTask,
  requireCanCreateContinuation,
  rejectDirectClientTaskCreation,
  rejectCmsOwnedDeletion,
  rejectCmsOwnedDateEdit,
} = require('../middlewares/taskAccess.middleware');
const taskAccess = require('../utils/taskAccess');
const employeeTaskValidator = require('../validators/employeeTask.validator');
const employeeTaskController = require('../controllers/employeeTask.controller');

const router = Router();

// Literal paths MUST come before the `/:id` catch-all below, or Express
// would try to resolve "mine"/"review"/"admin-filter" as a task id (see
// event.routes.js for the same ordering concern with /my-responsibilities
// vs /:id).
router.get('/mine', validate(employeeTaskValidator.listMine), employeeTaskController.listMine);
router.get('/mine/upcoming', employeeTaskController.listUpcoming);
router.get('/plan-next-day', employeeTaskController.planNextDay);
router.get('/review', employeeTaskController.listReview);
router.get(
  '/admin-filter',
  requireUnifiedTaskViewAccess(),
  validate(employeeTaskValidator.adminFilter),
  employeeTaskController.adminFilter
);

router.get('/:id', validate(employeeTaskValidator.getOrDelete), requireTaskAccess(taskAccess.canViewTask), employeeTaskController.get);
router.get(
  '/:id/subtasks',
  validate(employeeTaskValidator.getOrDelete),
  requireTaskAccess(taskAccess.canViewTask),
  employeeTaskController.listSubtasks
);

// requireCanCreateTopLevelTask runs after body validation so it can read
// the well-formed req.body.type/team — see taskAccess.middleware.js.
router.post(
  '/',
  validate(employeeTaskValidator.create),
  // Client tasks originate from the Client Management System's calendar,
  // which calls the service directly rather than coming through this route.
  rejectDirectClientTaskCreation,
  requireCanCreateTopLevelTask(),
  employeeTaskController.create
);
// requireCanUpdateTask/requireCanManageTask extend the same authority a
// leader gets at creation time to editing/deleting/following-up on their
// own team's tasks afterward — see taskAccess.middleware.js.
router.patch(
  '/:id',
  requireCanUpdateTask(),
  rejectCmsOwnedDateEdit,
  validate(employeeTaskValidator.update),
  employeeTaskController.update
);
router.delete(
  '/:id',
  requireCanManageTask("You don't have permission to delete this task."),
  rejectCmsOwnedDeletion,
  validate(employeeTaskValidator.getOrDelete),
  employeeTaskController.remove
);

router.post(
  '/:id/subtasks',
  validate(employeeTaskValidator.createSubtask),
  requireTaskAccess(taskAccess.canCreateSubtask, "You don't have permission to add subtasks to this task."),
  employeeTaskController.createSubtask
);

router.post(
  '/:id/follow-ups',
  requireCanManageTask("You don't have permission to add a follow-up to this task."),
  validate(employeeTaskValidator.addFollowUp),
  employeeTaskController.addFollowUp
);
router.patch(
  '/:id/follow-ups/:followUpId',
  validate(employeeTaskValidator.toggleFollowUp),
  requireTaskAccess(taskAccess.canToggleFollowUp, "You don't have permission to update this follow-up."),
  employeeTaskController.toggleFollowUp
);

router.post(
  '/:id/mark-for-review',
  validate(employeeTaskValidator.getOrDelete),
  requireTaskAccess(taskAccess.canMarkForReview, 'Only the assigned employee can mark this task for review.'),
  employeeTaskController.markForReview
);
router.post(
  '/:id/complete',
  validate(employeeTaskValidator.getOrDelete),
  requireTaskAccess(taskAccess.canMarkCompleted, "You don't have permission to complete this task."),
  employeeTaskController.markCompleted
);
// Review-optional counterpart to mark-for-review/complete — same audience
// as mark-for-review, but lands straight on COMPLETED.
router.post(
  '/:id/mark-completed-direct',
  validate(employeeTaskValidator.getOrDelete),
  requireTaskAccess(taskAccess.canMarkCompletedDirect, "You don't have permission to complete this task."),
  employeeTaskController.markCompletedDirect
);
router.post(
  '/:id/reject',
  validate(employeeTaskValidator.reject),
  requireTaskAccess(taskAccess.canRejectTask, "You don't have permission to reject this task."),
  employeeTaskController.reject
);
router.post(
  '/:id/continue',
  validate(employeeTaskValidator.createContinuation),
  requireCanCreateContinuation(),
  employeeTaskController.createContinuation
);
router.get(
  '/:id/chain',
  validate(employeeTaskValidator.getOrDelete),
  requireTaskAccess(taskAccess.canViewTask),
  employeeTaskController.getChain
);

// MOM-pipeline actions — only meaningful on a task carrying momPipeline
// (spawned from a meeting's MOM, see meeting.service.js#addTaskFromMom).
// Per-step authorisation happens inside momPipeline.service.js, same shape
// as the CMS calendar's /cms/items/:id/advance et al.
router.post('/:id/mom-pipeline/advance', validate(employeeTaskValidator.momPipelineDecision), employeeTaskController.momPipelineAdvance);
router.post('/:id/mom-pipeline/send-back', validate(employeeTaskValidator.momPipelineDecision), employeeTaskController.momPipelineSendBack);
router.post('/:id/mom-pipeline/reject', validate(employeeTaskValidator.momPipelineReject), employeeTaskController.momPipelineReject);

module.exports = router;
