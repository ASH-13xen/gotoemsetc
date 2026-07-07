const UploadedDocument = require('../models/UploadedDocument');

function create(data) {
  return UploadedDocument.create(data);
}

function listByEmployee(employeeId) {
  return UploadedDocument.find({ employee: employeeId }).sort({ createdAt: -1 });
}

function listByUploadRequest(uploadRequestId) {
  return UploadedDocument.find({ uploadRequest: uploadRequestId });
}

function findById(id) {
  return UploadedDocument.findById(id);
}

function deleteById(id) {
  return UploadedDocument.findByIdAndDelete(id);
}

module.exports = { create, listByEmployee, listByUploadRequest, findById, deleteById };
