const asyncHandler = require('../utils/asyncHandler');
const eventService = require('../services/event.service');

const list = asyncHandler(async (req, res) => {
  const events = await eventService.listEvents();
  res.json({ events });
});

const getById = asyncHandler(async (req, res) => {
  const result = await eventService.getEvent(req.params.id);
  res.json(result);
});

const create = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent(req.body, req.user.employeeLink);
  req.auditContext = { action: 'event.create', resourceType: 'Event', resourceId: event._id, metadata: { title: event.title } };
  res.status(201).json({ event });
});

const update = asyncHandler(async (req, res) => {
  const event = await eventService.updateEvent(req.params.id, req.body);
  req.auditContext = { action: 'event.update', resourceType: 'Event', resourceId: event._id, metadata: req.body };
  res.json({ event });
});

const reschedule = asyncHandler(async (req, res) => {
  const event = await eventService.rescheduleEvent(req.params.id, req.body, req.user.employeeLink);
  req.auditContext = { action: 'event.reschedule', resourceType: 'Event', resourceId: event._id, metadata: req.body };
  res.json({ event });
});

const complete = asyncHandler(async (req, res) => {
  const event = await eventService.markCompleted(req.params.id);
  res.json({ event });
});

const cancel = asyncHandler(async (req, res) => {
  const event = await eventService.markCancelled(req.params.id);
  res.json({ event });
});

const fillSummary = asyncHandler(async (req, res) => {
  const event = await eventService.fillSummary(req.params.id, req.body, req.user.employeeLink);
  req.auditContext = { action: 'event.fillSummary', resourceType: 'Event', resourceId: event._id };
  res.json({ event });
});

const remove = asyncHandler(async (req, res) => {
  await eventService.deleteEvent(req.params.id);
  req.auditContext = { action: 'event.delete', resourceType: 'Event', resourceId: req.params.id };
  res.status(204).send();
});

const createResponsibility = asyncHandler(async (req, res) => {
  const responsibility = await eventService.createResponsibility(req.params.id, req.body);
  res.status(201).json({ responsibility });
});

const updateResponsibility = asyncHandler(async (req, res) => {
  const responsibility = await eventService.updateResponsibility(req.params.id, req.body);
  res.json({ responsibility });
});

const setResponsibilityStatus = asyncHandler(async (req, res) => {
  const responsibility = await eventService.setResponsibilityStatus(req.params.id, req.body.status, req.user.employeeLink);
  res.json({ responsibility });
});

const removeResponsibility = asyncHandler(async (req, res) => {
  await eventService.deleteResponsibility(req.params.id);
  res.status(204).send();
});

const myResponsibilities = asyncHandler(async (req, res) => {
  const responsibilities = await eventService.listMyResponsibilities(req.user.employeeLink);
  res.json({ responsibilities });
});

module.exports = {
  list,
  getById,
  create,
  update,
  reschedule,
  complete,
  cancel,
  fillSummary,
  remove,
  createResponsibility,
  updateResponsibility,
  setResponsibilityStatus,
  removeResponsibility,
  myResponsibilities,
};
