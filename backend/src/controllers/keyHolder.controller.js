const asyncHandler = require('../utils/asyncHandler');
const keyHolderService = require('../services/keyHolder.service');

const list = asyncHandler(async (req, res) => {
  const keys = await keyHolderService.listKeys();
  res.json({ keys });
});

const assign = asyncHandler(async (req, res) => {
  const keyHolder = await keyHolderService.assignKeyHolders(req.params.key, req.body.employeeIds, req.user.id);
  req.auditContext = {
    action: 'keyHolder.assign',
    resourceType: 'KeyHolder',
    resourceId: keyHolder._id,
    metadata: { key: req.params.key, employeeIds: req.body.employeeIds ?? [] },
  };
  res.json({ keyHolder });
});

module.exports = { list, assign };
