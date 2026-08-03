const TaskEvent = require('../models/TaskEvent');

function list() {
  return TaskEvent.find({ isDeleted: false }).sort({ name: 1 });
}

function findById(id) {
  return TaskEvent.findOne({ _id: id, isDeleted: false });
}

function create(data) {
  return TaskEvent.create(data);
}

function updateById(id, data) {
  return TaskEvent.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  });
}

function softDeleteById(id) {
  return TaskEvent.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { returnDocument: 'after' });
}

module.exports = { list, findById, create, updateById, softDeleteById };
