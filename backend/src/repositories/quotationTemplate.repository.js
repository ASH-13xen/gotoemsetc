const QuotationTemplate = require('../models/QuotationTemplate');

function list() {
  return QuotationTemplate.find().sort({ title: 1 });
}

function findById(id) {
  return QuotationTemplate.findById(id);
}

function findByKey(key) {
  return QuotationTemplate.findOne({ key });
}

function updateFields(id, fields, isConfigured) {
  return QuotationTemplate.findByIdAndUpdate(
    id,
    { $set: { fields, isConfigured } },
    { returnDocument: 'after', runValidators: true }
  );
}

function updateScopeOfWork(id, scopeOfWork) {
  return QuotationTemplate.findByIdAndUpdate(
    id,
    { $set: { scopeOfWork } },
    { returnDocument: 'after', runValidators: true }
  );
}

module.exports = { list, findById, findByKey, updateFields, updateScopeOfWork };
