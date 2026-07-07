const asyncHandler = require('../utils/asyncHandler');
const uploadRequestService = require('../services/uploadRequest.service');

const getStatus = asyncHandler(async (req, res) => {
  const status = await uploadRequestService.getPublicStatus(req.params.token);
  res.json(status);
});

const uploadDocuments = asyncHandler(async (req, res) => {
  const saved = await uploadRequestService.attachDocuments(req.params.token, req.files || []);
  res.status(201).json({ uploaded: saved.map((d) => ({ docType: d.docType, url: d.url })) });
});

module.exports = { getStatus, uploadDocuments };
