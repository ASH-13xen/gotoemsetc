const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const uploadRequestService = require('../services/uploadRequest.service');
const localFileStorage = require('../services/localFileStorage.service');

const listForEmployee = asyncHandler(async (req, res) => {
  const uploadedDocuments = await uploadRequestService.listUploadedForEmployee(req.params.id);
  res.json({ uploadedDocuments });
});

const downloadFile = asyncHandler(async (req, res) => {
  const { filePath, namespace } = await uploadRequestService.getUploadedFilePath(req.params.id);
  res.sendFile(localFileStorage.absolutePathFor(filePath, namespace));
});

const remove = asyncHandler(async (req, res) => {
  await uploadRequestService.deleteUploadedDocument(req.params.id);
  res.status(204).send();
});

const adminUpload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file included in the upload.');
  const { docType, otherLabel } = req.body;
  const document = await uploadRequestService.adminUpload(req.params.id, { docType, otherLabel }, req.file);
  res.status(201).json({ document });
});

module.exports = { listForEmployee, downloadFile, remove, adminUpload };
