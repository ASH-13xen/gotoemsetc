const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const uploadRequestService = require('../services/uploadRequest.service');

const listForEmployee = asyncHandler(async (req, res) => {
  const uploadedDocuments = await uploadRequestService.listUploadedForEmployee(req.params.id);
  res.json({ uploadedDocuments });
});

const downloadFile = asyncHandler(async (req, res) => {
  const { data, filename, mimeType } = await uploadRequestService.getUploadedFile(req.params.id);
  res.set('Content-Type', mimeType);
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  res.send(data);
});

const remove = asyncHandler(async (req, res) => {
  await uploadRequestService.deleteUploadedDocument(req.params.id);
  res.status(204).send();
});

const adminUpload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file included in the upload.');
  const { docType, otherLabel } = req.body;
  // An earlier file of the same kind is kept (never deleted by an upload) —
  // the newest shows first; an old one is removed only on purpose.
  const document = await uploadRequestService.adminUpload(req.params.id, { docType, otherLabel }, req.file, { keepPrevious: true });
  res.status(201).json({ document });
});

module.exports = { listForEmployee, downloadFile, remove, adminUpload };
