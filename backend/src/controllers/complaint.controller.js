const asyncHandler = require('../utils/asyncHandler');
const { can } = require('../utils/roles');
const { ACCESS } = require('../config/access');
const ApiError = require('../utils/ApiError');
const complaintService = require('../services/complaint.service');
const { COMPLAINT_STATUS } = require('../config/constants');

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
// Operations sees every complaint; everyone else only their own. `mine=true`
// asks for the caller's own even when they could see everyone's — the
// dashboard's "My registered complaints" card, which would otherwise show a
// CEO or operations manager the whole company's.
const list = asyncHandler(async (req, res) => {
  const mineOnly = req.query.mine === 'true';
  if (mineOnly && !req.user.employeeLink) return res.json({ complaints: [] });
  const canSeeAll = !mineOnly && can(req.user, ACCESS.OPERATIONS);
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

const acknowledge = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) {
    throw ApiError.badRequest('No employee record is linked to this account');
  }
  const complaint = await complaintService.acknowledge(req.params.id, req.user.employeeLink);
  res.json({ complaint });
});

module.exports = { file, list, mineAwaitingReview, complete, review, acknowledge };
