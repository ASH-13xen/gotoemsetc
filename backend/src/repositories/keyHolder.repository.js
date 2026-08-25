const KeyHolder = require('../models/KeyHolder');

const HOLDER_FIELDS = 'firstName lastName employeeCode designation';

function listAll() {
  return KeyHolder.find().populate('holders', HOLDER_FIELDS).populate('updatedBy', 'username');
}

// Upsert — most keys won't have a document yet the first time they're
// assigned. `holderEmployeeIds` replaces the full holder list for this key
// (an empty array clears it back to unassigned) rather than adding/removing
// one at a time, matching the multi-select UI this feeds.
function setHolders(key, holderEmployeeIds, updatedBy) {
  return KeyHolder.findOneAndUpdate(
    { key },
    { holders: holderEmployeeIds, updatedBy },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .populate('holders', HOLDER_FIELDS)
    .populate('updatedBy', 'username');
}

module.exports = { listAll, setHolders };
