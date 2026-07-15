const Team = require('../models/Team');

const POPULATE = [
  { path: 'members', select: 'firstName lastName designation employeeCode' },
  { path: 'leader', select: 'firstName lastName designation employeeCode' },
];

function list() {
  return Team.find({ isDeleted: false }).sort({ name: 1 }).populate(POPULATE);
}

function findById(id) {
  return Team.findOne({ _id: id, isDeleted: false }).populate(POPULATE);
}

// Which teams a given employee belongs to — used to resolve "my"
// team-assigned event responsibilities without the caller needing to know
// team membership.
function listForMember(employeeId) {
  return Team.find({ members: employeeId, isDeleted: false });
}

function create(data) {
  return Team.create(data);
}

function updateById(id, data) {
  return Team.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  }).populate(POPULATE);
}

function softDeleteById(id) {
  return Team.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { returnDocument: 'after' });
}

module.exports = { list, findById, listForMember, create, updateById, softDeleteById };
