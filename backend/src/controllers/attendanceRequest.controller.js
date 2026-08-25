const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const attendanceRequestService = require('../services/attendanceRequest.service');
const { PERMISSIONS } = require('../config/constants');
const { isAdminLike } = require('../utils/roles');

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
const list = asyncHandler(async (req, res) => {
  const canSeeAll = isAdminLike(req.user) || req.user.permissions.includes(PERMISSIONS.MARK_ATTENDANCE);
  const employeeId = canSeeAll ? undefined : req.user.employeeLink;
  const requests = await attendanceRequestService.listRequests({ employeeId, status: req.query.status });
  res.json({ requests });
});

const resolve = asyncHandler(async (req, res) => {
  const request = await attendanceRequestService.resolveRequest(req.params.id, req.user.id, req.body, req.user.role);
  res.json({ request });
});

const reject = asyncHandler(async (req, res) => {
  const request = await attendanceRequestService.rejectRequest(req.params.id, req.user.id, req.body.reason);
  res.json({ request });
});

const cmApprove = asyncHandler(async (req, res) => {
  const request = await attendanceRequestService.approveAtContentManagerStage(req.params.id, req.user.id);
  res.json({ request });
});

// Self-scoped — the Content Manager's "pending my review" dashboard queue.
// Safe to call unconditionally: an account with no linked employee, or one
// not tagged content_manager anywhere, simply gets an empty list.
const pendingForContentManager = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) return res.json({ requests: [] });
  const requests = await attendanceRequestService.listPendingForContentManager(req.user.employeeLink);
  res.json({ requests });
});

const revoke = asyncHandler(async (req, res) => {
  const request = await attendanceRequestService.revokeRequest(req.params.id, req.user.id, req.user.role);
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
  res.json({ requests });
});

// Self-scoped — drives whether the "apply for leave" dialog even shows a
// Paid Leave option at all. Safe to call unconditionally: an account with no
// linked employee simply isn't eligible.
const paidLeaveEligibility = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) return res.json({ eligible: false });
  const eligible = await attendanceRequestService.checkPaidLeaveEligibility(req.user.employeeLink, req.query.date);
  res.json({ eligible });
});

module.exports = {
  create,
  list,
  resolve,
  reject,
  revoke,
  acknowledge,
  mineUnseen,
  paidLeaveEligibility,
  cmApprove,
  pendingForContentManager,
};
