const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const attendanceRequestService = require('../services/attendanceRequest.service');

const create = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) {
    throw ApiError.badRequest('No employee record is linked to this account');
  }
  const request = await attendanceRequestService.createRequest(req.user.employeeLink, req.body);
  res.status(201).json({ request });
});

// Admins see every request (optionally filtered by status); a worker only
// ever sees their own, regardless of what they pass — never trust the
// client for whose requests these are.
const list = asyncHandler(async (req, res) => {
  const employeeId = req.user.role === 'admin' ? undefined : req.user.employeeLink;
  const requests = await attendanceRequestService.listRequests({ employeeId, status: req.query.status });
  res.json({ requests });
});

const resolve = asyncHandler(async (req, res) => {
  const request = await attendanceRequestService.resolveRequest(req.params.id, req.user.id, req.body);
  res.json({ request });
});

module.exports = { create, list, resolve };
