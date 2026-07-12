const UploadRequest = require('../models/UploadRequest');
const { UPLOAD_REQUEST_STATUS } = require('../config/constants');

function create(data) {
  return UploadRequest.create(data);
}

function findByToken(token) {
  return UploadRequest.findOne({ token });
}

function findById(id) {
  return UploadRequest.findById(id);
}

function listByEmployee(employeeId) {
  return UploadRequest.find({ employee: employeeId }).sort({ createdAt: -1 });
}

function updateStatus(id, status, extra = {}) {
  return UploadRequest.findByIdAndUpdate(id, { status, ...extra }, { returnDocument: 'after' });
}

function clearAccessCode(id) {
  return UploadRequest.findByIdAndUpdate(id, { accessCode: null });
}

// Best-effort cleanup for requests nobody ever revisited after they expired
// (so the temporary code doesn't just sit valid-looking in the database
// forever) — run opportunistically whenever an employee's requests are
// listed, rather than needing a dedicated cron job.
function clearExpiredAccessCodes(employeeId) {
  return UploadRequest.updateMany(
    { employee: employeeId, expiresAt: { $lt: new Date() }, accessCode: { $ne: null } },
    { accessCode: null }
  );
}

function countPending() {
  return UploadRequest.countDocuments({
    status: { $in: [UPLOAD_REQUEST_STATUS.PENDING, UPLOAD_REQUEST_STATUS.PARTIALLY_FULFILLED] },
  });
}

module.exports = {
  create,
  findByToken,
  findById,
  listByEmployee,
  updateStatus,
  clearAccessCode,
  clearExpiredAccessCodes,
  countPending,
};
