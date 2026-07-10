const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const uploadRequestService = require('../services/uploadRequest.service');

function withLink(uploadRequest) {
  const obj = uploadRequest.toObject ? uploadRequest.toObject() : uploadRequest;
  return { ...obj, link: `${env.frontendUrl}/upload/${obj.token}` };
}

const create = asyncHandler(async (req, res) => {
  const { uploadRequest } = await uploadRequestService.createRequest(req.params.id, req.body);
  res.status(201).json({ uploadRequest: withLink(uploadRequest) });
});

const listForEmployee = asyncHandler(async (req, res) => {
  const uploadRequests = await uploadRequestService.listForEmployee(req.params.id);
  res.json({ uploadRequests: uploadRequests.map(withLink) });
});

const revoke = asyncHandler(async (req, res) => {
  const uploadRequest = await uploadRequestService.revoke(req.params.id);
  res.json({ uploadRequest });
});

module.exports = { create, listForEmployee, revoke };
