const ApiError = require('../utils/ApiError');
const reimbursementRepository = require('../repositories/reimbursement.repository');
const employeeRepository = require('../repositories/employee.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const { REIMBURSEMENT_CATEGORY, REIMBURSEMENT_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
const { istDayStart, istParts } = require('../utils/istDate');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A claim's expenseDate must be today or yesterday (IST) AND not before this
// week's Sunday — that second clause is what makes Sunday the one day that
// only accepts itself: yesterday (Saturday) is a payment cutoff, everything
// up to and including it is expected to already be paid that same Saturday,
// not newly claimed the day after.
function assertClaimWindow(expenseDate, now = new Date()) {
  const todayStart = istDayStart(now);
  const yesterdayStart = new Date(todayStart.getTime() - MS_PER_DAY);
  const weekStart = new Date(todayStart.getTime() - istParts(now).weekday * MS_PER_DAY);
  const expenseStart = istDayStart(expenseDate);

  const isTodayOrYesterday = expenseStart.getTime() === todayStart.getTime() || expenseStart.getTime() === yesterdayStart.getTime();
  const isWithinCurrentWeek = expenseStart.getTime() >= weekStart.getTime();

  if (!isTodayOrYesterday || !isWithinCurrentWeek) {
    throw ApiError.badRequest(
      'Reimbursements can only be claimed for today or yesterday, and never for a date already past its Saturday payment cutoff.'
    );
  }
}

async function fileReimbursement(employeeId, input) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  assertClaimWindow(new Date(input.expenseDate));

  if (input.category === REIMBURSEMENT_CATEGORY.TRAVEL && !input.travelMode) {
    throw ApiError.badRequest('Select whether this travel was cab (Ola/Rapido/Uber) or bike/petrol.');
  }

  const reimbursement = await reimbursementRepository.create({
    employee: employeeId,
    category: input.category,
    travelMode: input.category === REIMBURSEMENT_CATEGORY.TRAVEL ? input.travelMode : undefined,
    client: input.category === REIMBURSEMENT_CATEGORY.CLIENT_WORK ? input.client : undefined,
    clientBrandName: input.category === REIMBURSEMENT_CATEGORY.CLIENT_WORK ? input.clientBrandName : undefined,
    expenseDate: input.expenseDate,
    startAt: input.startAt,
    endAt: input.endAt,
    description: input.description,
    peopleInvolved: input.peopleInvolved || [],
    amount: input.amount,
  });

  const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
  const ceoUsers = await userRepository.findCeos();
  if (ceoUsers.length > 0) {
    await notificationService.createForUsers(ceoUsers.map((u) => u._id), {
      type: NOTIFICATION_TYPES.REIMBURSEMENT_CLAIMED,
      title: 'New reimbursement claim',
      message: `${employeeName} claimed ₹${input.amount.toLocaleString('en-IN')} for ${input.category.replace(/_/g, ' ')}.`,
      employee: employeeId,
      reimbursement: reimbursement._id,
    });
  }

  return reimbursementRepository.findById(reimbursement._id);
}

// Self-only, optional — see reimbursement.validator.js. Verified against the
// claim's own employee, same reasoning as complaint.service.js#submitFeedback.
async function attachReceipt(id, employeeId, file) {
  const reimbursement = await reimbursementRepository.findByIdWithFile(id);
  if (!reimbursement || reimbursement.employee.toString() !== employeeId) {
    throw ApiError.notFound('Reimbursement not found');
  }
  return reimbursementRepository.setReceiptFile(id, {
    data: file.buffer,
    contentType: file.mimetype,
    filename: file.originalname,
  });
}

async function listMine(employeeId) {
  return reimbursementRepository.listByEmployee(employeeId);
}

async function listAll(status) {
  return reimbursementRepository.listAll({ status });
}

// CEO-only (see requireRole(CEO) at the route).
async function approve(id, actingUser) {
  const existing = await reimbursementRepository.findById(id);
  if (!existing) throw ApiError.notFound('Reimbursement not found');
  if (existing.status !== REIMBURSEMENT_STATUS.PENDING) {
    throw ApiError.conflict('This reimbursement has already been decided');
  }

  const updated = await reimbursementRepository.updateById(id, {
    status: REIMBURSEMENT_STATUS.APPROVED,
    approvedBy: actingUser.id,
    approvedAt: new Date(),
  });
  await notifyEmployee(updated, NOTIFICATION_TYPES.REIMBURSEMENT_APPROVED, 'Reimbursement approved', 'Your reimbursement claim was approved — it will be paid this Saturday.');
  return updated;
}

async function reject(id, reason, actingUser) {
  const existing = await reimbursementRepository.findById(id);
  if (!existing) throw ApiError.notFound('Reimbursement not found');
  if (existing.status !== REIMBURSEMENT_STATUS.PENDING) {
    throw ApiError.conflict('This reimbursement has already been decided');
  }

  const updated = await reimbursementRepository.updateById(id, {
    status: REIMBURSEMENT_STATUS.REJECTED,
    approvedBy: actingUser.id,
    approvedAt: new Date(),
    rejectionReason: reason,
  });
  await notifyEmployee(updated, NOTIFICATION_TYPES.REIMBURSEMENT_REJECTED, 'Reimbursement rejected', `Your reimbursement claim was rejected: ${reason}`);
  return updated;
}

// requireFinanceAccess-gated, only from 'approved' — normally happens as
// part of the Saturday payment batch (see jobs/reimbursementPaymentReminder.job.js)
// but nothing stops paying one off-cycle if it's genuinely ready.
async function markPaid(id, transactionDetails, actingUser) {
  const existing = await reimbursementRepository.findById(id);
  if (!existing) throw ApiError.notFound('Reimbursement not found');
  if (existing.status !== REIMBURSEMENT_STATUS.APPROVED) {
    throw ApiError.conflict('Only an approved reimbursement can be marked paid');
  }

  const updated = await reimbursementRepository.updateById(id, {
    status: REIMBURSEMENT_STATUS.PAID,
    paidAt: new Date(),
    paidBy: actingUser.id,
    transactionDetails,
  });
  await notifyEmployee(updated, NOTIFICATION_TYPES.REIMBURSEMENT_PAID, 'Reimbursement paid', 'Your reimbursement claim has been paid.');
  return updated;
}

async function notifyEmployee(reimbursement, type, title, message) {
  const employeeUser = await userRepository.findByEmployeeId(reimbursement.employee._id || reimbursement.employee);
  if (!employeeUser) return;
  await notificationService.createForUsers([employeeUser._id], {
    type,
    title,
    message,
    employee: reimbursement.employee._id || reimbursement.employee,
    reimbursement: reimbursement._id,
  });
}

module.exports = { fileReimbursement, attachReceipt, listMine, listAll, approve, reject, markPaid, assertClaimWindow };
