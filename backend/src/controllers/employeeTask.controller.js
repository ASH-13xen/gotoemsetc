const asyncHandler = require('../utils/asyncHandler');
const employeeTaskService = require('../services/employeeTask.service');

const listMine = asyncHandler(async (req, res) => {
  const tasks = await employeeTaskService.listMine(req.user, { type: req.query.type });
  res.json({ tasks });
});

const listUpcoming = asyncHandler(async (req, res) => {
  const tasks = await employeeTaskService.listUpcoming(req.user, { limit: 6 });
  res.json({ tasks });
});

const listReview = asyncHandler(async (req, res) => {
  const { isReviewer, tasks } = await employeeTaskService.listReview(req.user);
  res.json({ isReviewer, tasks });
});

const adminFilter = asyncHandler(async (req, res) => {
  const tasks = await employeeTaskService.adminFilter({
    employeeId: req.query.employeeId,
    teamId: req.query.teamId,
  });
  res.json({ tasks });
});

const get = asyncHandler(async (req, res) => {
  // req.task is loaded and access-checked by taskAccess.middleware.js.
  res.json({ task: req.task });
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
  const task = await employeeTaskService.updateTask(req.params.id, req.body);
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

const markCompleted = asyncHandler(async (req, res) => {
  const task = await employeeTaskService.markCompleted(req.task, req.user.employeeLink);
  req.auditContext = { action: 'employeeTask.markCompleted', resourceType: 'EmployeeTask', resourceId: task._id };
  res.json({ task });
});

const markCompletedDirect = asyncHandler(async (req, res) => {
  const task = await employeeTaskService.markCompletedDirect(req.task, req.user.employeeLink);
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

module.exports = {
  listMine,
  listUpcoming,
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
};
