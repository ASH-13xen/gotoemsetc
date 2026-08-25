const Complaint = require('../models/Complaint');
const { COMPLAINT_STATUS } = require('../config/constants');

const EMPLOYEE_FIELDS = 'firstName lastName employeeCode designation';

function create(data) {
  return Complaint.create(data);
}

// Admin/CEO/Operations Manager see every complaint (optionally filtered by
// status); an employee only ever sees their own, mirroring the
// attendance-request list's "never trust the client for whose records these
// are" scoping.
function list({ employeeId, status } = {}) {
  const query = {};
  if (employeeId) query.employee = employeeId;
  if (status) query.status = status;
  return Complaint.find(query)
    .sort({ createdAt: -1 })
    .populate('employee', EMPLOYEE_FIELDS)
    .populate('completedBy', 'username');
}

function findById(id) {
  return Complaint.findById(id);
}

function markCompleted(id, completedBy) {
  return Complaint.findByIdAndUpdate(
    id,
    { status: COMPLAINT_STATUS.COMPLETED, completedBy, completedAt: new Date() },
    { new: true }
  );
}

function submitFeedback(id, feedback) {
  return Complaint.findByIdAndUpdate(
    id,
    {
      status: COMPLAINT_STATUS.REVIEWED,
      reviewedAt: new Date(),
      feedback,
    },
    { new: true }
  );
}

module.exports = { create, list, findById, markCompleted, submitFeedback };
