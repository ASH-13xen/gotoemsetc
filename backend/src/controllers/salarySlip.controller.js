const asyncHandler = require('../utils/asyncHandler');
const salarySlipService = require('../services/salarySlip.service');
const localFileStorage = require('../services/localFileStorage.service');
const logger = require('../utils/logger');

const generate = asyncHandler(async (req, res) => {
  const slip = await salarySlipService.generateSlip(req.params.id, req.body, req.user.id);
  req.auditContext = {
    action: 'salarySlip.generate',
    resourceType: 'SalarySlip',
    resourceId: slip._id,
    metadata: { employee: req.params.id, startDate: req.body.startDate, endDate: req.body.endDate },
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

// Self-service (frontendall dashboard) — see salarySlip.service.js for why
// this never computes or stores anything new.
const listRecentMonths = asyncHandler(async (req, res) => {
  const months = await salarySlipService.listRecentMonthsForEmployee(req.params.id);
  res.json({ months });
});

const downloadOwnFile = asyncHandler(async (req, res) => {
  const { filePath, namespace } = await salarySlipService.getOwnFilePath(req.params.id, req.params.slipId);
  res.sendFile(localFileStorage.absolutePathFor(filePath, namespace));
});

// HR Work bulk tool (frontendhr) — see salarySlip.service.js#generateBulkSlips
// for the date-of-joining clipping logic. Returns a per-employee outcome
// summary rather than raw slip payloads, since this can be a lot of PDFs.
const generateBulk = asyncHandler(async (req, res) => {
  const results = await salarySlipService.generateBulkSlips(req.body, req.user.id);
  res.status(201).json({ results });
});

// Companion to generateBulk — bundles a chosen set of already-generated
// slips (normally every 'generated' row from the response above) into one
// zip download, streamed straight through rather than buffered in memory.
const downloadBulkZip = asyncHandler(async (req, res) => {
  const archive = salarySlipService.buildBulkZip(req.body.slipIds);
  res.attachment(req.body.filename || `salary-slips-${Date.now()}.zip`);
  archive.on('error', (err) => {
    logger.error({ err }, 'Failed to build bulk salary-slip zip');
    if (!res.headersSent) res.status(500);
    res.end();
  });
  archive.pipe(res);
});

// Finance section — see salarySlip.service.js#listDueForFinance/#markSalaryPaid.
const listForFinance = asyncHandler(async (req, res) => {
  const slips = await salarySlipService.listDueForFinance(
    Number(req.query.year),
    Number(req.query.month)
  );
  res.json({ slips });
});

const markPaid = asyncHandler(async (req, res) => {
  const slip = await salarySlipService.markSalaryPaid(req.params.id, req.body, req.user);
  req.auditContext = { action: 'salarySlip.markPaid', resourceType: 'SalarySlip', resourceId: slip._id };
  res.json({ slip });
});

module.exports = {
  generate,
  listForEmployee,
  downloadFile,
  listRecentMonths,
  downloadOwnFile,
  generateBulk,
  downloadBulkZip,
  listForFinance,
  markPaid,
};
