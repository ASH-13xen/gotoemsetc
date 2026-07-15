const DevicePunch = require('../models/DevicePunch');

function create(data) {
  return DevicePunch.create(data);
}

function listRecent({ limit = 100, employeeId } = {}) {
  const query = {};
  if (employeeId) query.employee = employeeId;
  return DevicePunch.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('employee', 'firstName lastName employeeCode designation');
}

module.exports = { create, listRecent };
