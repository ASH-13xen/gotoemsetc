const ApiError = require('../utils/ApiError');
const clientRepository = require('../repositories/client.repository');
const clientNoteRepository = require('../repositories/clientNote.repository');
const clientActivity = require('./clientActivity.service');

async function addNote(clientId, body, createdBy) {
  const client = await clientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');

  const note = await clientNoteRepository.create({ client: clientId, body, createdBy });
  await clientActivity.log(clientId, 'NOTE_ADDED', {});
  return note;
}

async function listForClient(clientId) {
  return clientNoteRepository.listByClient(clientId);
}

async function deleteNote(id) {
  const note = await clientNoteRepository.findById(id);
  if (!note) throw ApiError.notFound('Note not found');
  await clientNoteRepository.deleteById(id);
}

module.exports = { addNote, listForClient, deleteNote };
