const asyncHandler = require('../utils/asyncHandler');
const salarySlipService = require('../services/salarySlip.service');
const localFileStorage = require('../services/localFileStorage.service');

const generate = asyncHandler(async (req, res) => {
  const slip = await salarySlipService.generateSlip(req.params.id, req.body, req.user.id);
  req.auditContext = {
    action: 'salarySlip.generate',
    resourceType: 'SalarySlip',
    resourceId: slip._id,
    metadata: { employee: req.params.id, month: req.body.month, year: req.body.year },
  };
  res.status(201).json({ slip });
});

const listForEmployee = asyncHandler(async (req, res) => {
  const slips = await salarySlipService.listForEmployee(req.params.id);
  res.json({ slips });
});

const downloadFile = asyncHandler(async (req, res) => {
  const { filePath, namespace } = await salarySlipService.getFilePath(req.params.id);
  res.sendFile(localFileStorage.absolutePathFor(filePath, namespace));
});

module.exports = { generate, listForEmployee, downloadFile };
