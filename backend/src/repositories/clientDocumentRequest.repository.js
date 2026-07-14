const ClientDocumentRequest = require('../models/ClientDocumentRequest');

function create(data) {
  return ClientDocumentRequest.create(data);
}

function findByToken(token) {
  return ClientDocumentRequest.findOne({ token });
}

function findById(id) {
  return ClientDocumentRequest.findById(id);
}

function listByClient(clientId) {
  return ClientDocumentRequest.find({ client: clientId }).sort({ createdAt: -1 });
}

function updateStatus(id, status, extra = {}) {
  return ClientDocumentRequest.findByIdAndUpdate(id, { status, ...extra }, { returnDocument: 'after' });
}

function clearAccessCode(id) {
  return ClientDocumentRequest.findByIdAndUpdate(id, { accessCode: null });
}

function clearExpiredAccessCodes(clientId) {
  return ClientDocumentRequest.updateMany(
    { client: clientId, expiresAt: { $lt: new Date() }, accessCode: { $ne: null } },
    { accessCode: null }
  );
}

module.exports = {
  create,
  findByToken,
  findById,
  listByClient,
  updateStatus,
  clearAccessCode,
  clearExpiredAccessCodes,
};
