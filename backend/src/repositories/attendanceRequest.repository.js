const AttendanceModificationRequest = require('../models/AttendanceModificationRequest');

function create(data) {
  return AttendanceModificationRequest.create(data);
}

// Admins see everything; a worker only ever calls this with their own
// employeeId (enforced by requireSelfOrAdmin at the route level).
function list({ employeeId, status } = {}) {
  const query = {};
  if (employeeId) query.employee = employeeId;
  if (status) query.status = status;
  return AttendanceModificationRequest.find(query).sort({ createdAt: -1 }).populate('employee', 'firstName lastName');
}

function findById(id) {
  return AttendanceModificationRequest.findById(id);
}

function resolve(id, resolvedBy) {
  return AttendanceModificationRequest.findByIdAndUpdate(
    id,
    { status: 'resolved', resolvedBy, resolvedAt: new Date() },
    { new: true }
  );
}

module.exports = { create, list, findById, resolve };
