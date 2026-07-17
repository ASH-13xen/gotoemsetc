const DevicePunch = require('../models/DevicePunch');

function create(data) {
  return DevicePunch.create(data);
}

function listRecent({ limit = 100, employeeId, from, to } = {}) {
  const query = {};
  if (employeeId) query.employee = employeeId;
  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = from;
    if (to) query.timestamp.$lte = to;
  }
  return DevicePunch.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('employee', 'firstName lastName employeeCode designation');
}

// Every scan for one employee on one calendar day, oldest first — this is
// what the classifier treats as "arrival" (first) and "departure" (last).
function listForEmployeeOnDay(employeeId, dayStart, dayEnd) {
  return DevicePunch.find({
    employee: employeeId,
    timestamp: { $gte: dayStart, $lte: dayEnd },
  }).sort({ timestamp: 1 });
}

module.exports = { create, listRecent, listForEmployeeOnDay };
