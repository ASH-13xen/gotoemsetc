const asyncHandler = require('../utils/asyncHandler');
const accessService = require('../services/access.service');
const salarySlipService = require('../services/salarySlip.service');
const salaryBatchService = require('../services/salaryBatch.service');
const { SALARY_BATCH_KIND } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const overtimeRequestService = require('../services/overtimeRequest.service');
const localFileStorage = require('../services/localFileStorage.service');
const logger = require('../utils/logger');

const generate = asyncHandler(async (req, res) => {
  const slip = await salarySlipService.generateSlip(req.params.id, req.body, req.user.id, req.user);
  // One slip from an employee's page waits for the CEO/admin too.
  await salaryBatchService.openBatch(
    { kind: SALARY_BATCH_KIND.SINGLE, month: slip.startDate.getUTCMonth() + 1, year: slip.startDate.getUTCFullYear(), slipIds: [slip._id] },
    req.user
  );
  req.auditContext = {
    action: 'salarySlip.generate',
    resourceType: 'SalarySlip',
    resourceId: slip._id,
    metadata: { employee: req.params.id, startDate: req.body.startDate, endDate: req.body.endDate },
  };
  res.status(201).json({ slip });
});

const listForEmployee = asyncHandler(async (req, res) => {
  const slips = await salarySlipService.listForEmployee(req.params.id, req.user);
  // Who generated each slip — only for them and the people above them.
  res.json({ slips: await accessService.shapeAttribution(req.user, slips, [{ by: 'createdBy', as: 'createdAs' }]) });
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
  const { filePath, namespace } = await salarySlipService.getOwnFilePath(req.params.id, req.params.slipId, req.user);
  res.sendFile(localFileStorage.absolutePathFor(filePath, namespace));
});

// HR Work bulk tool (frontendhr) — see salarySlip.service.js#generateBulkSlips
// for the date-of-joining clipping logic. Returns a per-employee outcome
// summary rather than raw slip payloads, since this can be a lot of PDFs.
const bulkPreview = asyncHandler(async (req, res) => {
  const period = { month: Number(req.query.month), year: Number(req.query.year) };
  const [employees, pendingOvertime] = await Promise.all([
    salarySlipService.listBulkCandidates(period, req.user),
    overtimeRequestService.countPendingForMonth(period),
  ]);
  // Unapproved overtime isn't paid — worth knowing before generating.
  res.json({ employees, pendingOvertime });
});

const generateBulk = asyncHandler(async (req, res) => {
  const results = await salarySlipService.generateBulkSlips(req.body, req.user.id, req.user);
  // The month's slips go to the CEO/admin as one batch — nothing is mailed
  // and Finance sees nothing until they approve.
  const batch = await salaryBatchService.openBatch(
    {
      kind: SALARY_BATCH_KIND.BULK,
      month: Number(req.body.month),
      year: Number(req.body.year),
      slipIds: results.filter((r) => r.outcome === 'generated' && r.slipId).map((r) => r.slipId),
    },
    req.user
  );
  res.status(201).json({ results, batchId: batch?._id ?? null });
});

// HR Work's Master Salary Sheet — one PDF for the whole month, built on
// demand and streamed back; nothing is stored.
const downloadMasterSheet = asyncHandler(async (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  const pdf = await salarySlipService.buildMasterSheet({ month, year });
  res.attachment(`master-salary-sheet-${year}-${String(month).padStart(2, '0')}.pdf`);
  res.type('application/pdf');
  res.send(pdf);
});

// Companion to generateBulk — bundles a chosen set of already-generated
// slips (normally every 'generated' row from the response above) into one
// zip download, streamed straight through rather than buffered in memory.
const downloadBulkZip = asyncHandler(async (req, res) => {
  const archive = salarySlipService.buildBulkZip(req.body.slipIds, { month: req.body.month, year: req.body.year });
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

// Finance opening one of the month's approved slips.
const downloadFinanceFile = asyncHandler(async (req, res) => {
  const { filePath, namespace } = await salarySlipService.getApprovedFilePath(req.params.id);
  res.sendFile(localFileStorage.absolutePathFor(filePath, namespace));
});

// Finance's own master sheet for the month — approved slips only.
const downloadFinanceMasterSheet = asyncHandler(async (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  const pdf = await salarySlipService.buildMasterSheet({ month, year }, { approvedOnly: true });
  res.attachment(`master-salary-sheet-${year}-${String(month).padStart(2, '0')}.pdf`);
  res.type('application/pdf');
  res.send(pdf);
});

// The CEO's/admin's approval of generated slips — salaryBatch.service.js.
const listBatches = asyncHandler(async (req, res) => {
  res.json(await salaryBatchService.listForApprover(req.user));
});

const approveBatch = asyncHandler(async (req, res) => {
  const batch = await salaryBatchService.approve(req.params.id, req.user);
  req.auditContext = { action: 'salaryBatch.approve', resourceType: 'SalaryBatch', resourceId: req.params.id, metadata: { slips: batch.slipCount } };
  res.json({ batch });
});

const sendBackBatch = asyncHandler(async (req, res) => {
  const batch = await salaryBatchService.sendBack(req.params.id, req.body.note, req.user);
  req.auditContext = { action: 'salaryBatch.sendBack', resourceType: 'SalaryBatch', resourceId: req.params.id, metadata: { note: req.body.note } };
  res.json({ batch });
});

// The "salary paid" notice on an employee's own dashboard.
const listPaidUnseen = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) return res.json({ slips: [] });
  res.json({ slips: await salarySlipService.listPaidUnseen(req.user.employeeLink) });
});

const markPaidSeen = asyncHandler(async (req, res) => {
  if (!req.user.employeeLink) throw ApiError.notFound('Salary slip not found');
  res.json({ slip: await salarySlipService.markPaidSeen(req.params.id, req.user.employeeLink) });
});

const downloadPaymentReceipt = asyncHandler(async (req, res) => {
  const file = await salarySlipService.getPaymentReceipt(req.params.id, req.user);
  res.set('Content-Type', file.contentType);
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename || 'payment-receipt')}"`);
  res.send(file.data);
});

const markPaid = asyncHandler(async (req, res) => {
  const slip = await salarySlipService.markSalaryPaid(req.params.id, req.body, req.user, req.file);
  req.auditContext = { action: 'salarySlip.markPaid', resourceType: 'SalarySlip', resourceId: slip._id };
  res.json({ slip });
});

module.exports = {
  generate,
  listForEmployee,
  downloadFile,
  downloadMasterSheet,
  listRecentMonths,
  downloadOwnFile,
  bulkPreview,
  generateBulk,
  downloadBulkZip,
  listForFinance,
  markPaid,
  downloadFinanceMasterSheet,
  downloadFinanceFile,
  listBatches,
  approveBatch,
  sendBackBatch,
  listPaidUnseen,
  markPaidSeen,
  downloadPaymentReceipt,
};
