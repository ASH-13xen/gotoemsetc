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

function setSignedFile(id, signedFile) {
  return GeneratedDocument.findByIdAndUpdate(id, { signedFile }, { returnDocument: 'after' }).select(
    WITHOUT_FILE_DATA
  );
}

module.exports = {
  create,
  listByEmployee,
  findById,
  findByIdWithFile,
  deleteById,
  countCompletedSince,
  setSignedFile,
};
