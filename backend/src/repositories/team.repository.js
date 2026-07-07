const Team = require('../models/Team');

function list() {
  return Team.find({ isDeleted: false }).sort({ name: 1 }).populate('members', 'firstName lastName designation employeeCode');
}

function findById(id) {
  return Team.findOne({ _id: id, isDeleted: false }).populate(
    'members',
    'firstName lastName designation employeeCode'
  );
}

function create(data) {
  return Team.create(data);
}

function updateById(id, data) {
  return Team.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  }).populate('members', 'firstName lastName designation employeeCode');
}

function softDeleteById(id) {
  return Team.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { returnDocument: 'after' });
}

module.exports = { list, findById, create, updateById, softDeleteById };
