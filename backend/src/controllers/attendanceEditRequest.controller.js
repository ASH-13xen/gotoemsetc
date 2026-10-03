const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/attendanceEditRequest.service');

function audit(req, action, id, metadata) {
  req.auditContext = { action, resourceType: 'AttendanceEditRequest', resourceId: id, metadata };
}

const create = asyncHandler(async (req, res) => {
  const request = await service.create(req.user, req.body);
  audit(req, 'attendanceEditRequest.create', request._id, req.body);
  res.status(201).json({ request });
});

const list = asyncHandler(async (req, res) => {
  res.json({ requests: await service.list(req.user, req.query) });
});

const approve = asyncHandler(async (req, res) => {
  const request = await service.decide(req.user, req.params.id, { approve: true, note: req.body.note });
  audit(req, 'attendanceEditRequest.approve', req.params.id, { note: req.body.note });
  res.json({ request });
});

const reject = asyncHandler(async (req, res) => {
  const request = await service.decide(req.user, req.params.id, { approve: false, note: req.body.note });
  audit(req, 'attendanceEditRequest.reject', req.params.id, { note: req.body.note });
  res.json({ request });
});

module.exports = { create, list, approve, reject };
