const ActivityLog = require('../models/ActivityLog');

function create(data) {
  return ActivityLog.create(data);
}

function listByEmployee(employeeId) {
  return ActivityLog.find({ employee: employeeId }).sort({ createdAt: -1 });
}

module.exports = { create, listByEmployee };
