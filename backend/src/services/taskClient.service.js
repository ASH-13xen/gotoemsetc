const ApiError = require('../utils/ApiError');
const taskClientRepository = require('../repositories/taskClient.repository');
const cloudinaryUploadService = require('./cloudinaryUpload.service');

async function listTaskClients() {
  return taskClientRepository.list();
}

async function getTaskClient(id) {
  const client = await taskClientRepository.findById(id);
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

async function createTaskClient(data) {
  try {
    const created = await taskClientRepository.create(data);
    // .create() doesn't populate — re-fetch so defaultTeam comes back
    // resolved, same as every other read of this resource.
    return await taskClientRepository.findById(created._id);
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('A client with this name already exists');
    throw err;
  }
}

async function updateTaskClient(id, data) {
  try {
    const client = await taskClientRepository.updateById(id, data);
    if (!client) throw ApiError.notFound('Client not found');
    return client;
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('A client with this name already exists');
    throw err;
  }
}

async function deleteTaskClient(id) {
  const client = await taskClientRepository.softDeleteById(id);
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

async function uploadLogo(id, file) {
  const client = await taskClientRepository.findById(id);
  if (!client) throw ApiError.notFound('Client not found');

  const upload = await cloudinaryUploadService.uploadBuffer(file.buffer, {
    folder: `ems/task-clients/${id}/logo`,
    publicId: `logo-${Date.now()}`,
    resourceType: 'image',
  });

  return taskClientRepository.updateById(id, { logoUrl: upload.secure_url });
}

module.exports = {
  listTaskClients,
  getTaskClient,
  createTaskClient,
  updateTaskClient,
  deleteTaskClient,
  uploadLogo,
};
