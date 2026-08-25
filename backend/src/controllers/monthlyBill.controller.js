const asyncHandler = require('../utils/asyncHandler');
const monthlyBillService = require('../services/monthlyBill.service');

const create = asyncHandler(async (req, res) => {
  const bill = await monthlyBillService.createBill(req.body, req.user);
  req.auditContext = { action: 'monthlyBill.create', resourceType: 'MonthlyBill', resourceId: bill._id };
  res.status(201).json({ bill });
});

const list = asyncHandler(async (req, res) => {
  const bills = await monthlyBillService.listAll();
  res.json({ bills });
});

const setActive = asyncHandler(async (req, res) => {
  const bill = await monthlyBillService.setActive(req.params.id, req.body.isActive);
  req.auditContext = { action: 'monthlyBill.setActive', resourceType: 'MonthlyBill', resourceId: bill._id };
  res.json({ bill });
});

const markPaid = asyncHandler(async (req, res) => {
  const bill = await monthlyBillService.markBillPaid(req.params.id, req.params.instanceId, req.body, req.user);
  req.auditContext = { action: 'monthlyBill.markPaid', resourceType: 'MonthlyBill', resourceId: bill._id };
  res.json({ bill });
});

const pendingReminders = asyncHandler(async (req, res) => {
  const reminders = await monthlyBillService.listPendingReminders(req.user.id);
  res.json({ reminders });
});

module.exports = { create, list, setActive, markPaid, pendingReminders };
