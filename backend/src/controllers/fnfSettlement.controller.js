const asyncHandler = require('../utils/asyncHandler');
const fnfSettlementService = require('../services/fnfSettlement.service');

function audit(req, action, id, metadata) {
  req.auditContext = { action, resourceType: 'FnfSettlement', resourceId: id, metadata };
}

// Finance's list.
const list = asyncHandler(async (req, res) => {
  res.json({ settlements: await fnfSettlementService.listAll() });
});

const listForHr = asyncHandler(async (req, res) => {
  res.json({ settlements: await fnfSettlementService.listForHr() });
});

const confirmLastDay = asyncHandler(async (req, res) => {
  const settlement = await fnfSettlementService.confirmLastDay(req.params.id, req.body, req.user);
  audit(req, 'fnfSettlement.confirmLastDay', req.params.id, req.body);
  res.json({ settlement });
});

const listForApproval = asyncHandler(async (req, res) => {
  res.json({ settlements: await fnfSettlementService.listForApproval(req.user) });
});

const approve = asyncHandler(async (req, res) => {
  const settlement = await fnfSettlementService.approve(req.params.id, req.user);
  audit(req, 'fnfSettlement.approve', req.params.id);
  res.json({ settlement });
});

const sendBack = asyncHandler(async (req, res) => {
  const settlement = await fnfSettlementService.sendBack(req.params.id, req.body.note, req.user);
  audit(req, 'fnfSettlement.sendBack', req.params.id, req.body);
  res.json({ settlement });
});

const markPaid = asyncHandler(async (req, res) => {
  const settlement = await fnfSettlementService.markPaid(req.params.id, req.body, req.user, req.file);
  audit(req, 'fnfSettlement.markPaid', settlement._id);
  res.json({ settlement });
});

const downloadDocument = asyncHandler(async (req, res) => {
  const file = await fnfSettlementService.getDocumentFile(req.params.id, req.user);
  res.set('Content-Type', file.contentType);
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
  res.send(file.data);
});

const downloadSlip = asyncHandler(async (req, res) => {
  res.sendFile(await fnfSettlementService.getSlipFilePath(req.params.id, req.user));
});

const downloadReceipt = asyncHandler(async (req, res) => {
  const file = await fnfSettlementService.getReceipt(req.params.id, req.user);
  res.set('Content-Type', file.contentType);
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename || 'payment-receipt')}"`);
  res.send(file.data);
});

module.exports = { list, listForHr, confirmLastDay, listForApproval, approve, sendBack, markPaid, downloadDocument, downloadSlip, downloadReceipt };
