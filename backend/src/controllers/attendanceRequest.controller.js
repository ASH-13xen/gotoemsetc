const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const attendanceRequestService = require('../services/attendanceRequest.service');
const accessService = require('../services/access.service');

// Who approved, rejected or undid a request — only for them and the people
// above them in the Organisation chart.
const ATTRIBUTION = [
  { by: 'resolvedBy', as: 'resolvedAs' },
  { by: 'hrApprovedBy', as: 'hrApprovedAs' },
  { by: 'revokedBy', as: 'revokedAs' },
];
const shape = (req, requests) => accessService.shapeAttribution(req.user, requests, ATTRIBUTION);
const { PERMISSIONS } = require('../config/constants');
const { can } = require('../utils/roles');
const { ACCESS } = require('../config/access');

const create = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) {
    throw ApiError.badRequest('No employee record is linked to this account');
  }
  const request = await attendanceRequestService.createRequest(req.user.employeeLink, req.body);
  res.status(201).json({ request });
});

// Admins, HR, and mark_attendance holders see every request (optionally
// filtered by status); anyone else only ever sees their own, regardless of
// what they pass — never trust the client for whose requests these are.
// HR-level access sees everyone's; everyone else only their own. `mine=true`
// asks for the caller's own even when they could see everyone's — the
// dashboard's "My leave applications" card.
const list = asyncHandler(async (req, res) => {
  const mineOnly = req.query.mine === 'true';
  if (mineOnly && !req.user.employeeLink) return res.json({ requests: [] });
  const canSeeAll = !mineOnly && (can(req.user, ACCESS.HRMS) || req.user.permissions.includes(PERMISSIONS.MARK_ATTENDANCE));
  const employeeId = canSeeAll ? undefined : req.user.employeeLink;
  const requests = await attendanceRequestService.listRequests({ employeeId, status: req.query.status });
  res.json({ requests: await shape(req, requests) });
});

const resolve = asyncHandler(async (req, res) => {
  const request = await attendanceRequestService.resolveRequest(req.params.id, req.user.id, req.body, req.user);
  res.json({ request });
});

const reject = asyncHandler(async (req, res) => {
  const request = await attendanceRequestService.rejectRequest(
    req.params.id,
    req.user.id,
    req.body.reason,
    req.user
  );
  res.json({ request });
});

const cmApprove = asyncHandler(async (req, res) => {
  const request = await attendanceRequestService.approveAtContentManagerStage(req.params.id, req.user.id, req.user);
  res.json({ request });
});

// Self-scoped — the Content Manager's "pending my review" dashboard queue.
// Safe to call unconditionally: an account with no linked employee, or one
// not tagged content_manager anywhere, simply gets an empty list.
const pendingForContentManager = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) return res.json({ requests: [] });
  const requests = await attendanceRequestService.listPendingForContentManager(req.user.employeeLink);
  res.json({ requests: await shape(req, requests) });
});

const revoke = asyncHandler(async (req, res) => {
  const request = await attendanceRequestService.revokeRequest(req.params.id, req.user.id, req.user);
  res.json({ request });
});

const acknowledgeOnDashboard = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) {
    throw ApiError.badRequest('No employee record is linked to this account');
  }
  const request = await attendanceRequestService.acknowledgeOnDashboard(req.params.id, req.user.employeeLink);
  res.json({ request });
});

const acknowledge = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) {
    throw ApiError.badRequest('No employee record is linked to this account');
  }
  const request = await attendanceRequestService.acknowledgeRequest(req.params.id, req.user.employeeLink);
  res.json({ request });
});

// Self-scoped, same "empty list for accounts with no linked employee"
// convention as /attendance-warnings/pending — safe to call unconditionally.
const mineUnseen = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) return res.json({ requests: [] });
  const requests = await attendanceRequestService.listUnseenForEmployee(req.user.employeeLink);
  res.json({ requests: await shape(req, requests) });
});

// Self-scoped — drives whether the "apply for leave" dialog even shows a
// Paid Leave option at all. Safe to call unconditionally: an account with no
// linked employee simply isn't eligible.
const paidLeaveEligibility = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) return res.json({ eligible: false, reason: 'probation' });
  const result = await attendanceRequestService.checkPaidLeaveEligibility(req.user.employeeLink, req.query.date);
  res.json(result);
});

// Self-scoped — the employee's own Late/Short Leave/Half Day tally for the
// month of `date`, shown in the "apply for leave" dialog. Approvers get the
// same numbers attached to each request instead (see listRequests).
const monthlyCounts = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) return res.json({ counts: null });
  const counts = await attendanceRequestService.getMonthlyCounts(req.user.employeeLink, req.query.date);
  res.json({ counts });
});

module.exports = {
  create,
  list,
  resolve,
  reject,
  revoke,
  acknowledge,
  acknowledgeOnDashboard,
  mineUnseen,
  paidLeaveEligibility,
  monthlyCounts,
  cmApprove,
  pendingForContentManager,
};
