const TaskMessage = require('../models/TaskMessage');

// Populated before returning so both the REST response and the live
// WebSocket broadcast (see task.controller.js) carry a ready-to-render
// sender, not a bare ObjectId.
async function create(data) {
  const message = await TaskMessage.create(data);
  return message.populate('sender', 'firstName lastName designation');
}

function listForTask(taskId) {
  return TaskMessage.find({ task: taskId }).sort({ createdAt: 1 }).populate('sender', 'firstName lastName designation');
}

module.exports = { create, listForTask };
