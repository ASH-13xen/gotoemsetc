const asyncHandler = require('../utils/asyncHandler');
const meetingService = require('../services/meeting.service');

const listForClient = asyncHandler(async (req, res) => {
  const meetings = await meetingService.listForClient(req.params.clientId);
  res.json({ meetings });
});

const get = asyncHandler(async (req, res) => {
  const meeting = await meetingService.getMeeting(req.params.id);
  res.json({ meeting });
});

const schedule = asyncHandler(async (req, res) => {
  const meeting = await meetingService.scheduleMeeting(req.body, req.user);
  req.auditContext = {
    action: 'meeting.schedule',
    resourceType: 'Meeting',
    resourceId: meeting._id,
    metadata: { client: req.body.clientId, scheduledAt: req.body.scheduledAt },
  };
  res.status(201).json({ meeting });
});

const log = asyncHandler(async (req, res) => {
  const meeting = await meetingService.logMeeting(req.body, req.user);
  req.auditContext = {
    action: 'meeting.log',
    resourceType: 'Meeting',
    resourceId: meeting._id,
    metadata: { client: req.body.clientId, scheduledAt: req.body.scheduledAt },
  };
  res.status(201).json({ meeting });
});

const reschedule = asyncHandler(async (req, res) => {
  const meeting = await meetingService.rescheduleMeeting(req.params.id, req.body.scheduledAt, req.user);
  req.auditContext = {
    action: 'meeting.reschedule',
    resourceType: 'Meeting',
    resourceId: meeting._id,
    metadata: { scheduledAt: req.body.scheduledAt },
  };
  res.json({ meeting });
});

const cancel = asyncHandler(async (req, res) => {
  const meeting = await meetingService.cancelMeeting(req.params.id, req.user);
  req.auditContext = { action: 'meeting.cancel', resourceType: 'Meeting', resourceId: meeting._id };
  res.json({ meeting });
});

const submitMom = asyncHandler(async (req, res) => {
  const meeting = await meetingService.submitMom(req.params.id, req.body, req.user);
  req.auditContext = { action: 'meeting.submitMom', resourceType: 'Meeting', resourceId: meeting._id };
  res.json({ meeting });
});

const addTask = asyncHandler(async (req, res) => {
  const task = await meetingService.addTaskFromMom(req.params.id, req.body, req.user);
  req.auditContext = {
    action: 'meeting.addTask',
    resourceType: 'EmployeeTask',
    resourceId: task._id,
    metadata: { meeting: req.params.id, kind: req.body.kind },
  };
  res.status(201).json({ task });
});

module.exports = { listForClient, get, schedule, log, reschedule, cancel, submitMom, addTask };
