const EventResponsibility = require('../models/EventResponsibility');

const POPULATE = [
  { path: 'assignedEmployees', select: 'firstName lastName designation employeeCode' },
  { path: 'assignedTeam', select: 'name' },
  { path: 'completedBy', select: 'firstName lastName' },
];

function listForEvent(eventId) {
  return EventResponsibility.find({ event: eventId, isDeleted: false }).sort({ dueDate: 1, createdAt: 1 }).populate(POPULATE);
}

function findRaw(id) {
  return EventResponsibility.findOne({ _id: id, isDeleted: false });
}

function findById(id) {
  return EventResponsibility.findOne({ _id: id, isDeleted: false }).populate(POPULATE);
}

function create(data) {
  return EventResponsibility.create(data);
}

async function updateById(id, patch) {
  const doc = await EventResponsibility.findOneAndUpdate({ _id: id, isDeleted: false }, patch, { new: true });
  return doc ? doc.populate(POPULATE) : null;
}

function softDeleteById(id) {
  return EventResponsibility.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { new: true });
}

// Everything assigned to this employee directly, or to any team they're on
// — the "due tasks" feed for their Event Management view and the shell
// dashboard widget. Populates `event` too since both call sites need to
// show which event a responsibility belongs to.
function listForEmployeeOrTeams(employeeId, teamIds) {
  return EventResponsibility.find({
    isDeleted: false,
    $or: [{ assignedEmployees: employeeId }, { assignedTeam: { $in: teamIds } }],
  })
    .sort({ dueDate: 1 })
    .populate([...POPULATE, { path: 'event', select: 'title startAt status' }]);
}

module.exports = { listForEvent, findRaw, findById, create, updateById, softDeleteById, listForEmployeeOrTeams };
