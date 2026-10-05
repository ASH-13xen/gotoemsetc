const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/overtimeRequest.service');

function audit(req, action, id, metadata) {
  req.auditContext = { action, resourceType: 'OvertimeRequest', resourceId: id, metadata };
}

const apply = asyncHandler(async (req, res) => {
  const request = await service.apply(req.user, req.body);
  audit(req, 'overtimeRequest.apply', request._id, { date: req.body.date, minutes: req.body.minutes });
  res.status(201).json({ request });
});

const pending = asyncHandler(async (req, res) => {
  res.json(await service.listForApprover(req.user));
});

const forEmployee = asyncHandler(async (req, res) => {
  res.json({ requests: await service.listForEmployee(req.user, req.params.employeeId, req.query) });
});

const cmApprove = asyncHandler(async (req, res) => {
  const request = await service.approveAsContentManager(req.user, req.params.id, req.body);
  audit(req, 'overtimeRequest.cmApprove', req.params.id, req.body);
  res.json({ request });
});

const approve = asyncHandler(async (req, res) => {
  const request = await service.approve(req.user, req.params.id, req.body);
  audit(req, 'overtimeRequest.approve', req.params.id, { minutes: request.approvedMinutes, note: req.body.note });
  res.json({ request });
});

const reject = asyncHandler(async (req, res) => {
  const request = await service.reject(req.user, req.params.id, req.body);
  audit(req, 'overtimeRequest.reject', req.params.id, req.body);
  res.json({ request });
});

module.exports = { apply, pending, forEmployee, cmApprove, approve, reject };
