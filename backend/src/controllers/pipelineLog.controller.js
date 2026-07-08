const asyncHandler = require('../utils/asyncHandler');
const pipelineLogService = require('../services/pipelineLog.service');

const list = asyncHandler(async (req, res) => {
  const result = await pipelineLogService.listForClient(req.query.client);
  res.json(result);
});

const create = asyncHandler(async (req, res) => {
  const entry = await pipelineLogService.createManualEntry(req.body, req.user.id);
  req.auditContext = {
    action: 'pipelineLog.create',
    resourceType: 'PipelineLogEntry',
    resourceId: entry._id,
    metadata: { client: req.body.client, stage: req.body.stage },
  };
  res.status(201).json({ entry });
});

module.exports = { list, create };
