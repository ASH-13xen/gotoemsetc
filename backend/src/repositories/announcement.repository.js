const Announcement = require('../models/Announcement');

const CREATED_BY_FIELDS = 'username';
const EMPLOYEE_FIELDS = 'firstName lastName employeeCode';

function create(data) {
  return Announcement.create(data);
}

// Admin-side management view — newest first.
function listAll() {
  return Announcement.find()
    .sort({ createdAt: -1 })
    .populate('createdBy', CREATED_BY_FIELDS)
    .populate('recipients', EMPLOYEE_FIELDS);
}

function findById(id) {
  return Announcement.findById(id);
}

// Every announcement addressed to this employee that they haven't
// acknowledged yet, oldest first — so the modal works through them in the
// order they were sent.
function listPendingForEmployee(employeeId) {
  return Announcement.find({
    recipients: employeeId,
    'acknowledgedBy.employee': { $ne: employeeId },
  }).sort({ createdAt: 1 });
}

function addAcknowledgement(id, employeeId) {
  return Announcement.findOneAndUpdate(
    { _id: id, 'acknowledgedBy.employee': { $ne: employeeId } },
    { $push: { acknowledgedBy: { employee: employeeId, acknowledgedAt: new Date() } } },
    { new: true }
  );
}

module.exports = { create, listAll, findById, listPendingForEmployee, addAcknowledgement };
