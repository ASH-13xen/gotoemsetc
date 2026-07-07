const GeneratedDocument = require('../models/GeneratedDocument');

function create(data) {
  return GeneratedDocument.create(data);
}

function listByEmployee(employeeId) {
  return GeneratedDocument.find({ employee: employeeId })
    .sort({ createdAt: -1 })
    .populate('template', 'key title category');
}

function findById(id) {
  return GeneratedDocument.findById(id).populate('template', 'key title category');
}

function deleteById(id) {
  return GeneratedDocument.findByIdAndDelete(id);
}

function countCompletedSince(date) {
  return GeneratedDocument.countDocuments({ status: 'completed', createdAt: { $gte: date } });
}

module.exports = { create, listByEmployee, findById, deleteById, countCompletedSince };
