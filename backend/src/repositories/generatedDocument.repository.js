const GeneratedDocument = require('../models/GeneratedDocument');

// The file bytes can be a few hundred KB each — fine to store, but never
// worth shipping over the wire for a list/detail view, so they're excluded
// here and only loaded by findByIdWithFile for the actual download route.
const WITHOUT_FILE_DATA = '-docx.data -pdf.data -signedFile.data';

function create(data) {
  return GeneratedDocument.create(data);
}

function listByEmployee(employeeId) {
  return GeneratedDocument.find({ employee: employeeId })
    .select(WITHOUT_FILE_DATA)
    .sort({ createdAt: -1 })
    .populate('template', 'key title category');
}

function findById(id) {
  return GeneratedDocument.findById(id).select(WITHOUT_FILE_DATA).populate('template', 'key title category');
}

function findByIdWithFile(id) {
  return GeneratedDocument.findById(id);
}

function deleteById(id) {
  return GeneratedDocument.findByIdAndDelete(id);
}

function countCompletedSince(date) {
  return GeneratedDocument.countDocuments({ status: 'completed', createdAt: { $gte: date } });
}

// Global, cross-employee — backs the Dashboard's "Documents generated this
// month" stat click-through. Same status/date filter as countCompletedSince
// above, so the number and the list it opens into always agree.
function listCompletedSince(date) {
  return GeneratedDocument.find({ status: 'completed', createdAt: { $gte: date } })
    .select(WITHOUT_FILE_DATA)
    .sort({ createdAt: -1 })
    .populate('employee', 'firstName lastName employeeCode designation')
    .populate('template', 'key title category');
}

// Every generated document for one template, without file bytes, most
// recent first — backs HR Work's "Generated documents" overview (frontendhr).
// A document's employee field is enough for the service to bucket by
// employee; signedFile.filename (not .data) is enough to tell signed from
// unsigned without loading the actual bytes.
function listByTemplate(templateId) {
  return GeneratedDocument.find({ template: templateId })
    .select('employee status createdAt signedFile.filename')
    .sort({ createdAt: -1 });
}

function setSignedFile(id, signedFile) {
  return GeneratedDocument.findByIdAndUpdate(id, { signedFile }, { returnDocument: 'after' }).select(
    WITHOUT_FILE_DATA
  );
}

module.exports = {
  create,
  listByEmployee,
  listCompletedSince,
  listByTemplate,
  findById,
  findByIdWithFile,
  deleteById,
  countCompletedSince,
  setSignedFile,
};
