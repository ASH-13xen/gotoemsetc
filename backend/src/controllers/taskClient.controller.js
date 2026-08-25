const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const taskClientService = require('../services/taskClient.service');
const clientManualService = require('../services/clientManual.service');

const list = asyncHandler(async (req, res) => {
  const clients = await taskClientService.listTaskClients();
  res.json({ clients });
});

const get = asyncHandler(async (req, res) => {
  const client = await taskClientService.getTaskClient(req.params.id);
  res.json({ client });
});

const create = asyncHandler(async (req, res) => {
  const client = await taskClientService.createTaskClient(req.body);
  req.auditContext = {
    action: 'taskClient.create',
    resourceType: 'TaskClient',
    resourceId: client._id,
    metadata: { name: client.name },
  };
  res.status(201).json({ client });
});

const update = asyncHandler(async (req, res) => {
  const client = await taskClientService.updateTaskClient(req.params.id, req.body, req.user);
  req.auditContext = {
    action: 'taskClient.update',
    resourceType: 'TaskClient',
    resourceId: client._id,
    metadata: { fields: Object.keys(req.body) },
  };
  res.json({ client });
});

const remove = asyncHandler(async (req, res) => {
  await taskClientService.deleteTaskClient(req.params.id);
  req.auditContext = { action: 'taskClient.delete', resourceType: 'TaskClient', resourceId: req.params.id };
  res.status(204).send();
});

const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No logo file provided');
  const client = await taskClientService.uploadLogo(req.params.id, req.file);
  req.auditContext = { action: 'taskClient.uploadLogo', resourceType: 'TaskClient', resourceId: client._id };
  res.json({ client });
});

// Generated fresh on every request — never stored, see clientManual.service.js.
const downloadManual = asyncHandler(async (req, res) => {
  const pdfBuffer = await clientManualService.generateManualPdf(req.params.id);
  req.auditContext = { action: 'taskClient.downloadManual', resourceType: 'TaskClient', resourceId: req.params.id };
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="client-manual-${req.params.id}.pdf"`);
  res.send(pdfBuffer);
});

module.exports = { list, get, create, update, remove, uploadLogo, downloadManual };
