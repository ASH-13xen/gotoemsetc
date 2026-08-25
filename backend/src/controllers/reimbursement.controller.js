const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const reimbursementService = require('../services/reimbursement.service');
const reimbursementRepository = require('../repositories/reimbursement.repository');
const { USER_ROLES } = require('../config/constants');

const file = asyncHandler(async (req, res) => {
  const reimbursement = await reimbursementService.fileReimbursement(req.user.employeeLink, req.body);
  req.auditContext = {
    action: 'reimbursement.file',
    resourceType: 'Reimbursement',
    resourceId: reimbursement._id,
    metadata: { category: req.body.category, amount: req.body.amount },
  };
  res.status(201).json({ reimbursement });
});

const uploadReceipt = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file was uploaded');
  const reimbursement = await reimbursementService.attachReceipt(req.params.id, req.user.employeeLink, req.file);
  res.status(201).json({ reimbursement });
});

// Self-or-Finance/CEO — an employee reading back their own receipt, or
// whoever needs it to decide/pay the claim.
const downloadReceipt = asyncHandler(async (req, res) => {
  const reimbursement = await reimbursementRepository.findByIdWithFile(req.params.id);
  if (!reimbursement) throw ApiError.notFound('Reimbursement not found');
  const isOwner = req.user.employeeLink && req.user.employeeLink === reimbursement.employee.toString();
  const isFinanceOrCeo = [USER_ROLES.ADMIN, USER_ROLES.CEO, USER_ROLES.ACCOUNT_MANAGER].includes(req.user.role);
  if (!isOwner && !isFinanceOrCeo) throw ApiError.forbidden();
  if (!reimbursement.receiptFile?.data) throw ApiError.notFound('No receipt on file');
  res.set('Content-Type', reimbursement.receiptFile.contentType);
  res.set('Content-Disposition', `attachment; filename="${reimbursement.receiptFile.filename}"`);
  res.send(reimbursement.receiptFile.data);
});

const listMine = asyncHandler(async (req, res) => {
  const reimbursements = await reimbursementService.listMine(req.user.employeeLink);
  res.json({ reimbursements });
});

const listAll = asyncHandler(async (req, res) => {
  const reimbursements = await reimbursementService.listAll(req.query.status);
  res.json({ reimbursements });
});

const approve = asyncHandler(async (req, res) => {
  const reimbursement = await reimbursementService.approve(req.params.id, req.user);
  req.auditContext = { action: 'reimbursement.approve', resourceType: 'Reimbursement', resourceId: reimbursement._id };
  res.json({ reimbursement });
});

const reject = asyncHandler(async (req, res) => {
  const reimbursement = await reimbursementService.reject(req.params.id, req.body.reason, req.user);
  req.auditContext = { action: 'reimbursement.reject', resourceType: 'Reimbursement', resourceId: reimbursement._id };
  res.json({ reimbursement });
});

const markPaid = asyncHandler(async (req, res) => {
  const reimbursement = await reimbursementService.markPaid(req.params.id, req.body, req.user);
  req.auditContext = { action: 'reimbursement.markPaid', resourceType: 'Reimbursement', resourceId: reimbursement._id };
  res.json({ reimbursement });
});

module.exports = { file, uploadReceipt, downloadReceipt, listMine, listAll, approve, reject, markPaid };
