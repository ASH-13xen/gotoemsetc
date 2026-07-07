const asyncHandler = require('../utils/asyncHandler');
const clientService = require('../services/client.service');

const list = asyncHandler(async (req, res) => {
  const result = await clientService.listClients(req.query);
  res.json(result);
});

const getById = asyncHandler(async (req, res) => {
  const client = await clientService.getClient(req.params.id);
  res.json({ client });
});

const register = asyncHandler(async (req, res) => {
  const client = await clientService.registerClient(req.body);
  req.auditContext = { action: 'client.create', resourceType: 'Client', resourceId: client._id, metadata: req.body };
  res.status(201).json({ client });
});

const update = asyncHandler(async (req, res) => {
  const client = await clientService.updateClient(req.params.id, req.body);
  req.auditContext = { action: 'client.update', resourceType: 'Client', resourceId: client._id, metadata: req.body };
  res.json({ client });
});

const addContact = asyncHandler(async (req, res) => {
  const client = await clientService.addContact(req.params.id, req.body);
  req.auditContext = {
    action: 'client.addContact',
    resourceType: 'Client',
    resourceId: client._id,
    metadata: req.body,
  };
  res.status(201).json({ client });
});

const removeContact = asyncHandler(async (req, res) => {
  const client = await clientService.removeContact(req.params.id, req.params.contactId);
  req.auditContext = {
    action: 'client.removeContact',
    resourceType: 'Client',
    resourceId: client._id,
    metadata: { contactId: req.params.contactId },
  };
  res.json({ client });
});

const offboard = asyncHandler(async (req, res) => {
  const client = await clientService.offboardClient(req.params.id);
  req.auditContext = { action: 'client.offboard', resourceType: 'Client', resourceId: client._id };
  res.json({ client });
});

const remove = asyncHandler(async (req, res) => {
  await clientService.deleteClient(req.params.id);
  req.auditContext = { action: 'client.delete', resourceType: 'Client', resourceId: req.params.id };
  res.status(204).send();
});

module.exports = { list, getById, register, update, addContact, removeContact, offboard, remove };
