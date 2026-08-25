const ApiError = require('../utils/ApiError');
const monthlyBillRepository = require('../repositories/monthlyBill.repository');
const notificationService = require('./notification.service');
const { MONTHLY_BILL_INSTANCE_STATUS, NOTIFICATION_TYPES } = require('../config/constants');

async function createBill(data, actingUser) {
  return monthlyBillRepository.create({
    name: data.name,
    amount: data.amount,
    dueDay: data.dueDay,
    createdBy: actingUser.id,
  });
}

async function listAll() {
  return monthlyBillRepository.listAll();
}

async function setActive(id, isActive) {
  const bill = await monthlyBillRepository.setActive(id, isActive);
  if (!bill) throw ApiError.notFound('Monthly bill not found');
  return bill;
}

// requireBillsAccess-gated (wider than the rest of Finance — see
// auth.middleware.js). paid vs paid_late is resolved here, at the moment of
// marking paid, by comparing now to the instance's own dueDate — same
// computed-flag pattern as EMPLOYEE_TASK_COMPLETION_FLAG's on_time/late.
async function markBillPaid(billId, instanceId, transactionDetails, actingUser) {
  const bill = await monthlyBillRepository.findById(billId);
  if (!bill) throw ApiError.notFound('Monthly bill not found');
  const instance = bill.instances.id(instanceId);
  if (!instance) throw ApiError.notFound('Bill instance not found');
  if (instance.status !== MONTHLY_BILL_INSTANCE_STATUS.DUE) {
    throw ApiError.conflict('This instance has already been marked paid');
  }

  const status = new Date() > instance.dueDate ? MONTHLY_BILL_INSTANCE_STATUS.PAID_LATE : MONTHLY_BILL_INSTANCE_STATUS.PAID;
  return monthlyBillRepository.markInstancePaid(billId, instanceId, { status, paidBy: actingUser.id, transactionDetails });
}

// Self-scoped, any authenticated user — backs the frontendall dashboard's
// non-dismissible reminder modal, same "driven purely by unread
// notifications" shape as attendanceWarning.service.js's pending-warnings
// check. Anyone not in the reminder job's recipient set simply gets an
// empty list back.
async function listPendingReminders(userId) {
  const notifications = await notificationService.listUnreadByType(userId, NOTIFICATION_TYPES.MONTHLY_BILL_DUE_REMINDER);
  return notifications.map((n) => ({
    notificationId: n._id,
    monthlyBill: n.monthlyBill,
    title: n.title,
    message: n.message,
    createdAt: n.createdAt,
  }));
}

module.exports = { createBill, listAll, setActive, markBillPaid, listPendingReminders };
