const User = require('../models/User');

function findByUsername(username) {
  return User.findOne({ username: username.toLowerCase(), isActive: true }).select('+passwordHash');
}

function findById(id) {
  return User.findOne({ _id: id, isActive: true });
}

// No isActive filter — the admin needs to see a revoked credential too
// (to know one exists and re-activate/replace it), not just active logins.
function findByEmployeeId(employeeId) {
  return User.findOne({ employeeLink: employeeId });
}

function findByIdAny(id) {
  return User.findById(id);
}

function create(data) {
  return User.create(data);
}

function updateById(id, data) {
  return User.findByIdAndUpdate(id, data, { new: true });
}

function list() {
  return User.find({ isActive: true }).sort({ username: 1 });
}

module.exports = { findByUsername, findById, findByEmployeeId, findByIdAny, create, updateById, list };
