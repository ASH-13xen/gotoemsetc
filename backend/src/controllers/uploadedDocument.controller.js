const asyncHandler = require('../utils/asyncHandler');
const uploadRequestService = require('../services/uploadRequest.service');

const listForEmployee = asyncHandler(async (req, res) => {
  const uploadedDocuments = await uploadRequestService.listUploadedForEmployee(req.params.id);
  res.json({ uploadedDocuments });
});

const remove = asyncHandler(async (req, res) => {
  await uploadRequestService.deleteUploadedDocument(req.params.id);
  res.status(204).send();
});

module.exports = { listForEmployee, remove };
