const Event = require('../models/Event');

const POPULATE = [
  { path: 'client', select: 'clientName brandName logoUrl' },
  { path: 'coordinator', select: 'firstName lastName designation employeeCode' },
  { path: 'createdBy', select: 'firstName lastName' },
  { path: 'summary.filledBy', select: 'firstName lastName' },
];

function list() {
  return Event.find({ isDeleted: false }).sort({ startAt: -1 }).populate(POPULATE);
}

function findById(id) {
  return Event.findOne({ _id: id, isDeleted: false }).populate(POPULATE);
}

function findRaw(id) {
  return Event.findOne({ _id: id, isDeleted: false });
}

function create(data) {
  return Event.create(data);
}

async function updateById(id, patch) {
  const event = await Event.findOneAndUpdate({ _id: id, isDeleted: false }, patch, { new: true });
  return event ? event.populate(POPULATE) : null;
}

function softDeleteById(id) {
  return Event.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { new: true });
}

module.exports = { list, findById, findRaw, create, updateById, softDeleteById };
