const KeyHolder = require('../models/KeyHolder');

const HOLDER_FIELDS = 'firstName lastName employeeCode designation';

function listAll() {
  return KeyHolder.find().populate('holder', HOLDER_FIELDS).populate('updatedBy', 'username');
}

// Upsert — most keys won't have a document yet the first time they're
// assigned. `holderEmployeeId` may be null to clear the key back to
// unassigned.
function setHolder(key, holderEmployeeId, updatedBy) {
  return KeyHolder.findOneAndUpdate(
    { key },
    { holder: holderEmployeeId, updatedBy },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .populate('holder', HOLDER_FIELDS)
    .populate('updatedBy', 'username');
}

module.exports = { listAll, setHolder };
