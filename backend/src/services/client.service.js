const ApiError = require('../utils/ApiError');
const { CLIENT_STATUS } = require('../config/constants');
const clientRepository = require('../repositories/client.repository');
const clientActivity = require('./clientActivity.service');
const cloudinaryUploadService = require('./cloudinaryUpload.service');

async function listClients(params) {
  return clientRepository.list(params);
}

async function getClient(id) {
  const client = await clientRepository.findById(id);
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

async function registerClient(data) {
  const client = await clientRepository.create(data);
  await clientActivity.log(client._id, 'CLIENT_REGISTERED', { clientName: client.clientName });
  return client;
}

async function updateClient(id, data) {
  const client = await clientRepository.updateById(id, data);
  if (!client) throw ApiError.notFound('Client not found');
  await clientActivity.log(id, 'CLIENT_UPDATED', data);
  return client;
}

async function addContact(id, contact) {
  const client = await clientRepository.addContact(id, contact);
  if (!client) throw ApiError.notFound('Client not found');
  await clientActivity.log(id, 'CONTACT_ADDED', { name: contact.name });
  return client;
}

async function removeContact(id, contactId) {
  const client = await clientRepository.removeContact(id, contactId);
  if (!client) throw ApiError.notFound('Client not found');
  await clientActivity.log(id, 'CONTACT_REMOVED', { contactId });
  return client;
}

async function uploadLogo(id, file) {
  const client = await clientRepository.findById(id);
  if (!client) throw ApiError.notFound('Client not found');

  const upload = await cloudinaryUploadService.uploadBuffer(file.buffer, {
    folder: `ems/clients/${id}/logo`,
    publicId: `logo-${Date.now()}`,
    resourceType: 'image',
  });

  return clientRepository.updateById(id, { logoUrl: upload.secure_url });
}

async function offboardClient(id) {
  const client = await clientRepository.updateById(id, { status: CLIENT_STATUS.OFFBOARDED });
  if (!client) throw ApiError.notFound('Client not found');
  await clientActivity.log(id, 'CLIENT_OFFBOARDED', {});
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
  uploadLogo,
  offboardClient,
  deleteClient,
};
