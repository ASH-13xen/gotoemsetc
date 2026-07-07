const Meeting = require('../models/Meeting');

function create(data) {
  return Meeting.create(data);
}

function listByClient(clientId) {
  return Meeting.find({ client: clientId })
    .sort({ meetingDate: -1 })
    .populate('attendees', 'firstName lastName designation employeeCode');
}

function findById(id) {
  return Meeting.findById(id).populate('attendees', 'firstName lastName designation employeeCode');
}

function listUpcoming(from, limit = 10) {
  return Meeting.find({ meetingDate: { $gte: from } })
    .sort({ meetingDate: 1 })
    .limit(limit)
    .populate('client', 'clientName brandName')
    .populate('attendees', 'firstName lastName designation employeeCode');
}

module.exports = { create, listByClient, findById, listUpcoming };
