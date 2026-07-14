const asyncHandler = require('../utils/asyncHandler');
const clientDocumentRequestService = require('../services/clientDocumentRequest.service');

const verifyAccessCode = asyncHandler(async (req, res) => {
  await clientDocumentRequestService.verifyAccessCode(req.params.token, req.body.code);
  res.json({ valid: true });
});

const getStatus = asyncHandler(async (req, res) => {
  const status = await clientDocumentRequestService.getPublicStatus(req.params.token, req.query.code);
  res.json(status);
});

const uploadDocuments = asyncHandler(async (req, res) => {
  const saved = await clientDocumentRequestService.attachDocuments(
    req.params.token,
    req.body.code,
    req.files || []
  );
  res.status(201).json({ uploaded: saved.map((d) => ({ slotIndex: d.slotIndex, docLabel: d.docLabel })) });
});

module.exports = { verifyAccessCode, getStatus, uploadDocuments };
