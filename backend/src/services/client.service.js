const ApiError = require('../utils/ApiError');
const { CLIENT_STATUS } = require('../config/constants');
const clientRepository = require('../repositories/client.repository');

async function listClients(params) {
  return clientRepository.list(params);
}

async function getClient(id) {
  const client = await clientRepository.findById(id);
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

async function registerClient(data) {
  return clientRepository.create(data);
}

async function updateClient(id, data) {
  const client = await clientRepository.updateById(id, data);
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

async function addContact(id, contact) {
  const client = await clientRepository.addContact(id, contact);
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

async function removeContact(id, contactId) {
  const client = await clientRepository.removeContact(id, contactId);
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

async function offboardClient(id) {
  const client = await clientRepository.updateById(id, { status: CLIENT_STATUS.OFFBOARDED });
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

async function deleteClient(id) {
  const client = await clientRepository.softDeleteById(id);
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

module.exports = {
  listClients,
  getClient,
  registerClient,
  updateClient,
  addContact,
  removeContact,
  offboardClient,
  deleteClient,
};
