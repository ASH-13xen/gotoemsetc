const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const complaintService = require('../services/complaint.service');
const { COMPLAINT_STATUS, USER_ROLES } = require('../config/constants');

const file = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) {
    throw ApiError.badRequest('No employee record is linked to this account');
  }
  const complaint = await complaintService.fileComplaint(req.user.employeeLink, req.body);
  req.auditContext = {
    action: 'complaint.file',
    resourceType: 'Complaint',
    resourceId: complaint._id,
    metadata: { category: req.body.category },
  };
  res.status(201).json({ complaint });
});

// Operations (admin/ceo/operations_manager) see every complaint, optionally
// filtered by status; anyone else only ever sees their own, regardless of
// what they pass — never trust the client for whose complaints these are.
const list = asyncHandler(async (req, res) => {
  const canSeeAll =
    req.user.role === USER_ROLES.ADMIN || req.user.role === USER_ROLES.CEO || req.user.role === USER_ROLES.OPERATIONS_MANAGER;
  const employeeId = canSeeAll ? undefined : req.user.employeeLink;
  const complaints = await complaintService.listComplaints({ employeeId, status: req.query.status });
  res.json({ complaints });
});

// Self-scoped — the filer's own complaints currently awaiting their review,
// i.e. status 'completed'. Drives the blocking review modal in frontendall.
const mineAwaitingReview = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) return res.json({ complaints: [] });
  const complaints = await complaintService.listComplaints({
    employeeId: req.user.employeeLink,
    status: COMPLAINT_STATUS.COMPLETED,
  });
  res.json({ complaints });
});

const complete = asyncHandler(async (req, res) => {
  const complaint = await complaintService.markCompleted(req.params.id, req.user.id);
  req.auditContext = {
    action: 'complaint.complete',
    resourceType: 'Complaint',
    resourceId: complaint._id,
  };
  res.json({ complaint });
});

const review = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) {
    throw ApiError.badRequest('No employee record is linked to this account');
  }
  const complaint = await complaintService.submitFeedback(req.params.id, req.user.employeeLink, req.body);
  res.json({ complaint });
});

module.exports = { file, list, mineAwaitingReview, complete, review };
