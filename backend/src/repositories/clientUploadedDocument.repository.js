const ClientUploadedDocument = require('../models/ClientUploadedDocument');

function create(data) {
  return ClientUploadedDocument.create(data);
}

function listByClient(clientId) {
  return ClientUploadedDocument.find({ client: clientId }).sort({ createdAt: -1 });
}

function listByRequest(requestId) {
  return ClientUploadedDocument.find({ clientDocumentRequest: requestId });
}

function findById(id) {
  return ClientUploadedDocument.findById(id);
}

function deleteById(id) {
  return ClientUploadedDocument.findByIdAndDelete(id);
}

module.exports = { create, listByClient, listByRequest, findById, deleteById };
