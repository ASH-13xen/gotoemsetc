const asyncHandler = require('../utils/asyncHandler');
const meetingService = require('../services/meeting.service');

const create = asyncHandler(async (req, res) => {
  const meeting = await meetingService.createMeeting(req.params.id, req.body);
  req.auditContext = {
    action: 'meeting.create',
    resourceType: 'Meeting',
    resourceId: meeting._id,
    metadata: { client: req.params.id, meetingDate: req.body.meetingDate },
  };
  res.status(201).json({ meeting });
});

const listForClient = asyncHandler(async (req, res) => {
  const meetings = await meetingService.listMeetings(req.params.id);
  res.json({ meetings });
});

const updateMinutes = asyncHandler(async (req, res) => {
  const meeting = await meetingService.updateMinutes(req.params.meetingId, req.body.mom);
  req.auditContext = {
    action: 'meeting.updateMinutes',
    resourceType: 'Meeting',
    resourceId: meeting._id,
  };
  res.json({ meeting });
});

module.exports = { create, listForClient, updateMinutes };
