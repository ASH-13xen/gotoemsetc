const asyncHandler = require('../utils/asyncHandler');
const uploadRequestService = require('../services/uploadRequest.service');

const verifyAccessCode = asyncHandler(async (req, res) => {
  await uploadRequestService.verifyAccessCode(req.params.token, req.body.code);
  res.json({ valid: true });
});

const getStatus = asyncHandler(async (req, res) => {
  const status = await uploadRequestService.getPublicStatus(req.params.token, req.query.code);
  res.json(status);
});

const uploadDocuments = asyncHandler(async (req, res) => {
  const saved = await uploadRequestService.attachDocuments(
    req.params.token,
    req.body.code,
    req.files || []
  );
  res.status(201).json({ uploaded: saved.map((d) => ({ docType: d.docType, url: d.url })) });
});

module.exports = { verifyAccessCode, getStatus, uploadDocuments };
