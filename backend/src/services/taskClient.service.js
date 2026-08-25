const ApiError = require('../utils/ApiError');
const taskClientRepository = require('../repositories/taskClient.repository');
const cloudinaryUploadService = require('./cloudinaryUpload.service');

// At most one contact carries isPrimary, and if the caller sent contacts but
// flagged none, the first becomes primary. Enforced here rather than in the
// schema because a client mid-onboarding with zero contacts is legitimate.
function normalizeContacts(data) {
  if (!Array.isArray(data.contacts) || data.contacts.length === 0) return data;

  const firstFlagged = data.contacts.findIndex((c) => c.isPrimary);
  const primaryIndex = firstFlagged === -1 ? 0 : firstFlagged;
  return {
    ...data,
    contacts: data.contacts.map((c, i) => ({ ...c, isPrimary: i === primaryIndex })),
  };
}

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
    const created = await taskClientRepository.create(normalizeContacts(data));
    // .create() doesn't populate — re-fetch so defaultTeam comes back
    // resolved, same as every other read of this resource.
    return await taskClientRepository.findById(created._id);
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('A client with this name already exists');
    throw err;
  }
}

async function updateTaskClient(id, data, actingUser) {
  try {
    const normalized = normalizeContacts(data);

    // A real reassignment (not just the field being absent from this PATCH)
    // gets logged to teamHistory before the write, so the manual can later
    // say exactly when it happened — see TaskClient.js#teamHistoryEntrySchema.
    if ('defaultTeam' in normalized) {
      const current = await taskClientRepository.findById(id);
      if (!current) throw ApiError.notFound('Client not found');
      const currentTeamId = current.defaultTeam?._id?.toString() ?? null;
      const newTeamId = normalized.defaultTeam ? String(normalized.defaultTeam) : null;
      if (newTeamId !== currentTeamId) {
        await taskClientRepository.recordTeamChange(id, newTeamId, actingUser?.id ?? null);
      }
    }

    const client = await taskClientRepository.updateById(id, normalized);
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
