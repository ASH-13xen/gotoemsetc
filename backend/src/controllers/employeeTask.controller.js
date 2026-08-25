const asyncHandler = require('../utils/asyncHandler');
const employeeTaskService = require('../services/employeeTask.service');
const planNextDayService = require('../services/planNextDay.service');
const momPipelineService = require('../services/momPipeline.service');
const momPipeline = require('../utils/momPipeline');

const listMine = asyncHandler(async (req, res) => {
  const tasks = await employeeTaskService.listMine(req.user, { type: req.query.type });
  res.json({ tasks });
});

const listUpcoming = asyncHandler(async (req, res) => {
  const tasks = await employeeTaskService.listUpcoming(req.user, { limit: 6 });
  res.json({ tasks });
});

const planNextDay = asyncHandler(async (req, res) => {
  const digest = await planNextDayService.getDigest(req.user);
  res.json({ digest });
});

const listReview = asyncHandler(async (req, res) => {
  const { isReviewer, tasks } = await employeeTaskService.listReview(req.user);
  res.json({ isReviewer, tasks });
});

const adminFilter = asyncHandler(async (req, res) => {
  const tasks = await employeeTaskService.adminFilter({
    clientId: req.query.clientId,
    teamId: req.query.teamId,
    employeeId: req.query.employeeId,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
  });
  res.json({ tasks });
});

// Decorated with the resolved step trail/colour/canAct when this task
// carries a momPipeline — same "resolved server-side so it can't drift"
// principle as the CMS calendar's getItemView, and it saves the frontend
// from porting the actor-resolution logic to TypeScript just to know
// whether to show the advance/send-back/reject buttons.
const get = asyncHandler(async (req, res) => {
  // req.task is loaded and access-checked by taskAccess.middleware.js.
  const task = req.task;
  let momPipelineView;
  if (task.momPipeline?.kind) {
    momPipelineView = {
      trail: momPipeline.stepTrail(task.momPipeline),
      color: momPipeline.colorFor(task.momPipeline),
      canAct: momPipeline.canActOnCurrentStep(req.user, task.momPipeline, task.team),
    };
  }
  res.json({ task, momPipelineView });
});

const listSubtasks = asyncHandler(async (req, res) => {
  const subtasks = await employeeTaskService.listSubtasks(req.params.id);
  res.json({ subtasks });
});

const create = asyncHandler(async (req, res) => {
  const task = await employeeTaskService.createTask(req.body, req.user.employeeLink);
  req.auditContext = {
    action: 'employeeTask.create',
    resourceType: 'EmployeeTask',
    resourceId: task._id,
    metadata: { title: task.title, type: task.type },
  };
  res.status(201).json({ task });
});

const update = asyncHandler(async (req, res) => {
  const task = await employeeTaskService.updateTask(req.params.id, req.body, req.user);
  req.auditContext = {
    action: 'employeeTask.update',
    resourceType: 'EmployeeTask',
    resourceId: task._id,
    metadata: { fields: Object.keys(req.body) },
  };
  res.json({ task });
});

const remove = asyncHandler(async (req, res) => {
  await employeeTaskService.removeTask(req.params.id);
  req.auditContext = { action: 'employeeTask.delete', resourceType: 'EmployeeTask', resourceId: req.params.id };
  res.status(204).send();
});

const createSubtask = asyncHandler(async (req, res) => {
  const subtask = await employeeTaskService.createSubtask(req.params.id, req.body, req.user.employeeLink);
  req.auditContext = {
    action: 'employeeTask.createSubtask',
    resourceType: 'EmployeeTask',
    resourceId: subtask._id,
    metadata: { parentTask: req.params.id, title: subtask.title },
  };
  res.status(201).json({ task: subtask });
});

const addFollowUp = asyncHandler(async (req, res) => {
  const task = await employeeTaskService.addFollowUp(req.params.id, req.body);
  req.auditContext = { action: 'employeeTask.addFollowUp', resourceType: 'EmployeeTask', resourceId: task._id };
  res.status(201).json({ task });
});

const toggleFollowUp = asyncHandler(async (req, res) => {
  const task = await employeeTaskService.toggleFollowUp(
    req.params.id,
    req.params.followUpId,
    req.body.isDone,
    req.user.employeeLink
  );
  req.auditContext = {
    action: 'employeeTask.toggleFollowUp',
    resourceType: 'EmployeeTask',
    resourceId: task._id,
    metadata: { followUpId: req.params.followUpId, isDone: req.body.isDone },
  };
  res.json({ task });
});

const markForReview = asyncHandler(async (req, res) => {
  const task = await employeeTaskService.markForReview(req.task, req.user.employeeLink);
  req.auditContext = { action: 'employeeTask.markForReview', resourceType: 'EmployeeTask', resourceId: task._id };
  res.json({ task });
});

// Pass the full req.user (not just the employee id) — a CMS-owned subtask's
// completion may need to trigger the linked CalendarItem's pipeline to
// advance, which needs the acting user's role too (admin/CEO override,
// global Team Leader). See employeeTaskService.markCompleted/
// markCompletedDirect and services/cms/pipelineBridge.service.js.
const markCompleted = asyncHandler(async (req, res) => {
  const task = await employeeTaskService.markCompleted(req.task, req.user);
  req.auditContext = { action: 'employeeTask.markCompleted', resourceType: 'EmployeeTask', resourceId: task._id };
  res.json({ task });
});

const markCompletedDirect = asyncHandler(async (req, res) => {
  const task = await employeeTaskService.markCompletedDirect(req.task, req.user);
  req.auditContext = { action: 'employeeTask.markCompletedDirect', resourceType: 'EmployeeTask', resourceId: task._id };
  res.json({ task });
});

const reject = asyncHandler(async (req, res) => {
  const task = await employeeTaskService.rejectTask(req.task, req.body, req.user.employeeLink);
  req.auditContext = {
    action: 'employeeTask.reject',
    resourceType: 'EmployeeTask',
    resourceId: task._id,
    metadata: { note: req.body.note },
  };
  res.json({ task });
});

const createContinuation = asyncHandler(async (req, res) => {
  const task = await employeeTaskService.createContinuation(req.params.id, req.body, req.user.employeeLink);
  req.auditContext = {
    action: 'employeeTask.createContinuation',
    resourceType: 'EmployeeTask',
    resourceId: task._id,
    metadata: { continuesFrom: req.params.id },
  };
  res.status(201).json({ task });
});

const getChain = asyncHandler(async (req, res) => {
  const chain = await employeeTaskService.getChain(req.params.id);
  res.json({ chain });
});

// MOM-pipeline actions — see momPipeline.service.js. Authorised inside the
// service (per-step actor, same shape as the CMS calendar's advance/
// send-back/reject), not at the route, since who may act depends on which
// step the task's momPipeline currently sits at.
const momPipelineAdvance = asyncHandler(async (req, res) => {
  const task = await momPipelineService.advance(req.params.id, req.user, req.body);
  req.auditContext = { action: 'employeeTask.momPipeline.advance', resourceType: 'EmployeeTask', resourceId: task._id };
  res.json({ task });
});

const momPipelineSendBack = asyncHandler(async (req, res) => {
  const task = await momPipelineService.sendBack(req.params.id, req.user, req.body);
  req.auditContext = { action: 'employeeTask.momPipeline.sendBack', resourceType: 'EmployeeTask', resourceId: task._id };
  res.json({ task });
});

const momPipelineReject = asyncHandler(async (req, res) => {
  const task = await momPipelineService.reject(req.params.id, req.user, req.body);
  req.auditContext = { action: 'employeeTask.momPipeline.reject', resourceType: 'EmployeeTask', resourceId: task._id };
  res.json({ task });
});

module.exports = {
  listMine,
  listUpcoming,
  planNextDay,
  listReview,
  adminFilter,
  get,
  listSubtasks,
  create,
  update,
  remove,
  createSubtask,
  addFollowUp,
  toggleFollowUp,
  markForReview,
  markCompleted,
  markCompletedDirect,
  reject,
  createContinuation,
  getChain,
  momPipelineAdvance,
  momPipelineSendBack,
  momPipelineReject,
};
