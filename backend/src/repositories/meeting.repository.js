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

function updateById(id, data) {
  return Meeting.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate(
    'attendees',
    'firstName lastName designation employeeCode'
  );
}

module.exports = { create, listByClient, findById, updateById };
