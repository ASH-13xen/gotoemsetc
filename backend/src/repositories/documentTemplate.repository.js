const DocumentTemplate = require('../models/DocumentTemplate');

function list({ active } = {}) {
  const query = active === undefined ? {} : { isActive: active };
  return DocumentTemplate.find(query).sort({ sortOrder: 1, title: 1 });
}

function findById(id) {
  return DocumentTemplate.findById(id);
}

function findByKey(key) {
  return DocumentTemplate.findOne({ key });
}

function upsertByKey(key, data) {
  return DocumentTemplate.findOneAndUpdate({ key }, data, {
    returnDocument: 'after',
    upsert: true,
    runValidators: true,
  });
}

module.exports = { list, findById, findByKey, upsertByKey };
