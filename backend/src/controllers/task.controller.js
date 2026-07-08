const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const taskService = require('../services/task.service');

const list = asyncHandler(async (req, res) => {
  const result = await taskService.listTasks(req.query);
  res.json(result);
});

const getById = asyncHandler(async (req, res) => {
  const task = await taskService.getTask(req.params.id);
  res.json({ task });
});

const create = asyncHandler(async (req, res) => {
  const task = await taskService.createTask(req.body, req.user.id);
  req.auditContext = { action: 'task.create', resourceType: 'Task', resourceId: task._id, metadata: req.body };
  res.status(201).json({ task });
});

const update = asyncHandler(async (req, res) => {
  const task = await taskService.updateTask(req.params.id, req.body);
  req.auditContext = { action: 'task.update', resourceType: 'Task', resourceId: task._id, metadata: req.body };
  res.json({ task });
});

const updateStatus = asyncHandler(async (req, res) => {
  const task = await taskService.updateStatus(req.params.id, req.body.status, req.body.summary);
  req.auditContext = {
    action: 'task.updateStatus',
    resourceType: 'Task',
    resourceId: task._id,
    metadata: { status: req.body.status },
  };
  res.json({ task });
});

const remove = asyncHandler(async (req, res) => {
  await taskService.deleteTask(req.params.id);
  req.auditContext = { action: 'task.delete', resourceType: 'Task', resourceId: req.params.id };
  res.status(204).send();
});

const addComment = asyncHandler(async (req, res) => {
  const task = await taskService.addComment(req.params.id, req.user, req.body.body);
  req.auditContext = { action: 'task.comment', resourceType: 'Task', resourceId: task._id };
  res.status(201).json({ task });
});

const uploadAttachment = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file provided');
  const task = await taskService.addAttachment(req.params.id, req.file, req.user.id);
  req.auditContext = {
    action: 'task.addAttachment',
    resourceType: 'Task',
    resourceId: task._id,
    metadata: { originalFilename: req.file.originalname },
  };
  res.status(201).json({ task });
});

const removeAttachment = asyncHandler(async (req, res) => {
  const task = await taskService.removeAttachment(req.params.id, req.params.attachmentId);
  req.auditContext = {
    action: 'task.removeAttachment',
    resourceType: 'Task',
    resourceId: task._id,
    metadata: { attachmentId: req.params.attachmentId },
  };
  res.json({ task });
});

const dueSummary = asyncHandler(async (req, res) => {
  const clientIds = String(req.query.clients || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const items = await taskService.nextDueForClients(clientIds);
  res.json({ items });
});

module.exports = {
  list,
  getById,
  create,
  update,
  updateStatus,
  remove,
  addComment,
  uploadAttachment,
  removeAttachment,
  dueSummary,
};
