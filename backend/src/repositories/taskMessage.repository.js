const TaskMessage = require('../models/TaskMessage');

function create(data) {
  return TaskMessage.create(data);
}

function listForTask(taskId) {
  return TaskMessage.find({ task: taskId }).sort({ createdAt: 1 }).populate('sender', 'firstName lastName designation');
}

module.exports = { create, listForTask };
