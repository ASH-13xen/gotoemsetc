const asyncHandler = require('../utils/asyncHandler');
const keyHolderService = require('../services/keyHolder.service');

const list = asyncHandler(async (req, res) => {
  const keys = await keyHolderService.listKeys();
  res.json({ keys });
});

const assign = asyncHandler(async (req, res) => {
  const keyHolder = await keyHolderService.assignKey(req.params.key, req.body.employeeId, req.user.id);
  req.auditContext = {
    action: 'keyHolder.assign',
    resourceType: 'KeyHolder',
    resourceId: keyHolder._id,
    metadata: { key: req.params.key, employeeId: req.body.employeeId ?? null },
  };
  res.json({ keyHolder });
});

module.exports = { list, assign };
