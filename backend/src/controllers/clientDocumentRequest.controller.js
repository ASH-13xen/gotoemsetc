const asyncHandler = require('../utils/asyncHandler');
const clientDocumentRequestService = require('../services/clientDocumentRequest.service');
const localFileStorage = require('../services/localFileStorage.service');

const env = require('../config/env');

function withLink(request) {
  const obj = request.toObject ? request.toObject() : request;
  return { ...obj, link: `${env.salesFrontendUrl}/client-documents/${obj.token}` };
}

const create = asyncHandler(async (req, res) => {
  const request = await clientDocumentRequestService.createRequest(req.params.id, req.body);
  res.status(201).json({ request: withLink(request) });
});

const listForClient = asyncHandler(async (req, res) => {
  const requests = await clientDocumentRequestService.listForClient(req.params.id);
  res.json({ requests: requests.map(withLink) });
});

const revoke = asyncHandler(async (req, res) => {
  const request = await clientDocumentRequestService.revoke(req.params.id);
  res.json({ request });
});

const listUploaded = asyncHandler(async (req, res) => {
  const documents = await clientDocumentRequestService.listUploadedForClient(req.params.id);
  res.json({ documents });
});

const downloadUploaded = asyncHandler(async (req, res) => {
  const { filePath, namespace } = await clientDocumentRequestService.getUploadedFilePath(req.params.docId);
  res.sendFile(localFileStorage.absolutePathFor(filePath, namespace));
});

const removeUploaded = asyncHandler(async (req, res) => {
  await clientDocumentRequestService.deleteUploadedDocument(req.params.docId);
  res.status(204).send();
});

module.exports = { create, listForClient, revoke, listUploaded, downloadUploaded, removeUploaded };
