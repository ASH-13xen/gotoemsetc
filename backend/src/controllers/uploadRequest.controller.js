const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const uploadRequestService = require('../services/uploadRequest.service');

const create = asyncHandler(async (req, res) => {
  const { uploadRequest, rawToken } = await uploadRequestService.createRequest(
    req.params.id,
    req.body
  );
  const link = `${env.frontendUrl}/upload/${rawToken}`;
  res.status(201).json({ uploadRequest, link });
});

const listForEmployee = asyncHandler(async (req, res) => {
  const uploadRequests = await uploadRequestService.listForEmployee(req.params.id);
  res.json({ uploadRequests });
});

const revoke = asyncHandler(async (req, res) => {
  const uploadRequest = await uploadRequestService.revoke(req.params.id);
  res.json({ uploadRequest });
});

module.exports = { create, listForEmployee, revoke };
