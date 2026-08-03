const TaskClient = require('../models/TaskClient');

const TEAM_POPULATE = { path: 'defaultTeam', select: 'name leader members' };

function list() {
  return TaskClient.find({ isDeleted: false }).sort({ name: 1 }).populate(TEAM_POPULATE);
}

function findById(id) {
  return TaskClient.findOne({ _id: id, isDeleted: false }).populate(TEAM_POPULATE);
}

function create(data) {
  return TaskClient.create(data);
}

function updateById(id, data) {
  return TaskClient.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  }).populate(TEAM_POPULATE);
}

function softDeleteById(id) {
  return TaskClient.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { returnDocument: 'after' });
}

module.exports = { list, findById, create, updateById, softDeleteById };
