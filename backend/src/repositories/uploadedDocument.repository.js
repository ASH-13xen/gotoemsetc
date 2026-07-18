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

// A re-upload of the same doc type for this employee is a replace, not an
// addition — see uploadRequest.service.js#attachDocuments, which destroys
// each match's Cloudinary asset before calling this.
function findByEmployeeAndDocType(employeeId, docType) {
  return UploadedDocument.find({ employee: employeeId, docType });
}

function findById(id) {
  return UploadedDocument.findById(id);
}

function deleteById(id) {
  return UploadedDocument.findByIdAndDelete(id);
}

module.exports = {
  create,
  listByEmployee,
  listByUploadRequest,
  findById,
  findByEmployeeAndDocType,
  deleteById,
};
