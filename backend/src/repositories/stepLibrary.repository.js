const StepLibrary = require('../models/StepLibrary');

function list() {
  return StepLibrary.find({ isDeleted: false }).sort({ label: 1 });
}

function create(label) {
  return StepLibrary.create({ label });
}

function updateById(id, label) {
  return StepLibrary.findOneAndUpdate({ _id: id, isDeleted: false }, { label }, { returnDocument: 'after' });
}

function softDeleteById(id) {
  return StepLibrary.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { returnDocument: 'after' });
}

module.exports = { list, create, updateById, softDeleteById };
