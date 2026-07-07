const UploadRequest = require('../models/UploadRequest');
const { UPLOAD_REQUEST_STATUS } = require('../config/constants');

function create(data) {
  return UploadRequest.create(data);
}

function findByTokenHash(tokenHash) {
  return UploadRequest.findOne({ tokenHash });
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

function countPending() {
  return UploadRequest.countDocuments({
    status: { $in: [UPLOAD_REQUEST_STATUS.PENDING, UPLOAD_REQUEST_STATUS.PARTIALLY_FULFILLED] },
  });
}

module.exports = { create, findByTokenHash, findById, listByEmployee, updateStatus, countPending };
