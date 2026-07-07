const Quotation = require('../models/Quotation');
const { QUOTATION_STATUS } = require('../config/constants');

function listByClient(clientId) {
  return Quotation.find({ client: clientId })
    .sort({ version: -1 })
    .populate('template', 'key title companyLabel planOptions planType');
}

// The quotation a client is currently "on" — every generate/change supersedes
// whatever came before, so at most one non-superseded quotation exists per
// client at any time.
function findCurrentForClient(clientId) {
  return Quotation.findOne({ client: clientId, status: { $ne: QUOTATION_STATUS.SUPERSEDED } })
    .sort({ version: -1 })
    .populate('template');
}

function findLatestVersion(clientId) {
  return Quotation.findOne({ client: clientId }).sort({ version: -1 }).select('version');
}

function findById(id) {
  return Quotation.findById(id).populate('template');
}

function findByIdWithToken(id) {
  return Quotation.findById(id).select('+shareTokenHash').populate('template');
}

function findByTokenHash(tokenHash) {
  return Quotation.findOne({ shareTokenHash: tokenHash }).select('+shareTokenHash').populate('template').populate('client');
}

function create(data) {
  return Quotation.create(data);
}

function updateById(id, data) {
  return Quotation.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' });
}

function markSuperseded(id) {
  return Quotation.findByIdAndUpdate(id, { $set: { status: QUOTATION_STATUS.SUPERSEDED } });
}

function supersedeAllForClient(clientId) {
  return Quotation.updateMany(
    { client: clientId, status: { $ne: QUOTATION_STATUS.SUPERSEDED } },
    { $set: { status: QUOTATION_STATUS.SUPERSEDED } }
  );
}

module.exports = {
  listByClient,
  findCurrentForClient,
  findLatestVersion,
  findById,
  findByIdWithToken,
  findByTokenHash,
  create,
  updateById,
  markSuperseded,
  supersedeAllForClient,
};
