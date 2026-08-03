const ApiError = require('../utils/ApiError');
const taskEventRepository = require('../repositories/taskEvent.repository');

async function listTaskEvents() {
  return taskEventRepository.list();
}

async function getTaskEvent(id) {
  const event = await taskEventRepository.findById(id);
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

async function createTaskEvent(data) {
  return taskEventRepository.create(data);
}

async function updateTaskEvent(id, data) {
  const event = await taskEventRepository.updateById(id, data);
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

async function deleteTaskEvent(id) {
  const event = await taskEventRepository.softDeleteById(id);
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

module.exports = { listTaskEvents, getTaskEvent, createTaskEvent, updateTaskEvent, deleteTaskEvent };
