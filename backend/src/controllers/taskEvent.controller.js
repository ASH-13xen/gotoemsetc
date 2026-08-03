const asyncHandler = require('../utils/asyncHandler');
const taskEventService = require('../services/taskEvent.service');

const list = asyncHandler(async (req, res) => {
  const events = await taskEventService.listTaskEvents();
  res.json({ events });
});

const get = asyncHandler(async (req, res) => {
  const event = await taskEventService.getTaskEvent(req.params.id);
  res.json({ event });
});

const create = asyncHandler(async (req, res) => {
  const event = await taskEventService.createTaskEvent(req.body);
  req.auditContext = {
    action: 'taskEvent.create',
    resourceType: 'TaskEvent',
    resourceId: event._id,
    metadata: { name: event.name },
  };
  res.status(201).json({ event });
});

const update = asyncHandler(async (req, res) => {
  const event = await taskEventService.updateTaskEvent(req.params.id, req.body);
  req.auditContext = {
    action: 'taskEvent.update',
    resourceType: 'TaskEvent',
    resourceId: event._id,
    metadata: { fields: Object.keys(req.body) },
  };
  res.json({ event });
});

const remove = asyncHandler(async (req, res) => {
  await taskEventService.deleteTaskEvent(req.params.id);
  req.auditContext = { action: 'taskEvent.delete', resourceType: 'TaskEvent', resourceId: req.params.id };
  res.status(204).send();
});

module.exports = { list, get, create, update, remove };
