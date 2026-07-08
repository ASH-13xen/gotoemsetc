const ApiError = require('../utils/ApiError');
const { TASK_STAGE, TASK_STATUS, USER_ROLES } = require('../config/constants');
const taskRepository = require('../repositories/task.repository');
const pipelineLogRepository = require('../repositories/pipelineLog.repository');
const cloudinaryUpload = require('../services/cloudinaryUpload.service');

async function listTasks(params) {
  return taskRepository.list(params);
}

async function getTask(id) {
  const task = await taskRepository.findById(id);
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

// Every labeled task (fixed stage or custom-with-a-label) gets exactly one
// mirrored row in the client's Pipeline tab, kept in sync as the task
// changes — see PipelineLogEntry's upsert-by-sourceTask semantics.
async function syncPipelineCopy(task, loggedById) {
  if (task.stage === TASK_STAGE.CUSTOM && !task.customLabel) return;
  await pipelineLogRepository.upsertForTask(task, loggedById);
}

async function createTask(data, createdBy) {
  const task = await taskRepository.create({ ...data, createdBy });
  await syncPipelineCopy(task, createdBy);
  return task;
}

async function updateTask(id, data) {
  const task = await taskRepository.updateById(id, data);
  if (!task) throw ApiError.notFound('Task not found');
  await syncPipelineCopy(task, task.createdBy);
  return task;
}

async function deleteTask(id) {
  const task = await taskRepository.softDeleteById(id);
  if (!task) throw ApiError.notFound('Task not found');
  await pipelineLogRepository.removeForTask(id);
  return task;
}

async function updateStatus(id, status, summary) {
  if (status === TASK_STATUS.DONE && !summary) {
    throw ApiError.badRequest('A summary is required to mark a task as done');
  }
  const patch = { status };
  if (status === TASK_STATUS.DONE) patch.summary = summary;
  const task = await taskRepository.updateById(id, patch);
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

// Anyone who can log in can view a task; only the admin or one of the
// task's assigned employees may post a message on it.
function canMessage(task, user) {
  if (user.role === USER_ROLES.ADMIN) return true;
  if (!user.employeeLink) return false;
  return task.assigneeEmployees.some((e) => e._id.toString() === user.employeeLink);
}

async function addComment(id, user, body) {
  const task = await taskRepository.findById(id);
  if (!task) throw ApiError.notFound('Task not found');
  if (!canMessage(task, user)) {
    throw ApiError.forbidden('Only admins and this task\'s assignees can post messages');
  }
  const updated = await taskRepository.pushComment(id, { author: user.id, body });
  return updated;
}

async function addAttachment(id, file, uploadedBy) {
  const publicId = `tasks/${id}/${Date.now()}${cloudinaryUpload.extensionFor(file.originalname, file.mimetype)}`;
  const result = await cloudinaryUpload.uploadBuffer(file.buffer, { folder: 'tasks', publicId, resourceType: 'raw' });
  const task = await taskRepository.pushAttachment(id, {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    uploadedBy,
  });
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

async function removeAttachment(id, attachmentId) {
  const existing = await taskRepository.findById(id);
  if (!existing) throw ApiError.notFound('Task not found');
  const attachment = existing.attachments.id(attachmentId);
  if (attachment) {
    await cloudinaryUpload.destroy(attachment.publicId, { resourceType: attachment.resourceType });
  }
  return taskRepository.pullAttachment(id, attachmentId);
}

async function nextDueForClients(clientIds) {
  return taskRepository.findNextDueForClients(clientIds);
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  updateStatus,
  canMessage,
  addComment,
  addAttachment,
  removeAttachment,
  nextDueForClients,
};
