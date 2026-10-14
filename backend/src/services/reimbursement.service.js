const ApiError = require('../utils/ApiError');
const reimbursementRepository = require('../repositories/reimbursement.repository');
const employeeRepository = require('../repositories/employee.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const { REIMBURSEMENT_CATEGORY, REIMBURSEMENT_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
const { istDayStart, istParts } = require('../utils/istDate');
const accessService = require('./access.service');
const { ACCESS, GRANTS } = require('../config/access');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Reimbursements run on a Monday-to-Sunday week and are paid on the Monday
// after it. A claim's expenseDate must be today or yesterday (IST) AND not
// before this week's Monday — that second clause is what makes Monday the
// one day that only accepts itself: yesterday (Sunday) closed the week being
// paid out today, so it is expected to be claimed by Sunday night, not newly
// claimed on payday.
function weekMondayStart(date) {
  const dayStart = istDayStart(date);
  // istParts().weekday: 0 = Sunday … 6 = Saturday.
  return new Date(dayStart.getTime() - ((istParts(date).weekday + 6) % 7) * MS_PER_DAY);
}

function assertClaimWindow(expenseDate, now = new Date()) {
  const todayStart = istDayStart(now);
  const yesterdayStart = new Date(todayStart.getTime() - MS_PER_DAY);
  const weekStart = weekMondayStart(now);
  const expenseStart = istDayStart(expenseDate);

  const isTodayOrYesterday = expenseStart.getTime() === todayStart.getTime() || expenseStart.getTime() === yesterdayStart.getTime();
  const isWithinCurrentWeek = expenseStart.getTime() >= weekStart.getTime();

  if (!isTodayOrYesterday || !isWithinCurrentWeek) {
    throw ApiError.badRequest(
      'Reimbursements can only be claimed for today or yesterday, and never for a week that has already closed — a week runs Monday to Sunday and is paid on the following Monday.'
    );
  }
}

// The Monday a claim is paid on: the one after its expense's Monday–Sunday
// week — or, if that has already gone by (it was approved late), the next
// Monday from now.
function payoutMonday(expenseDate, now = new Date()) {
  const afterItsWeek = new Date(weekMondayStart(expenseDate).getTime() + 7 * MS_PER_DAY);
  const todayStart = istDayStart(now);
  if (afterItsWeek.getTime() >= todayStart.getTime()) return afterItsWeek;
  const thisMonday = weekMondayStart(now);
  return thisMonday.getTime() === todayStart.getTime() ? thisMonday : new Date(thisMonday.getTime() + 7 * MS_PER_DAY);
}

const fmtPayout = (date) => date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

// The receipt is part of the claim itself — no claim without one.
async function fileReimbursement(employeeId, input, receipt) {
  const employee = await employeeRepository.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  assertClaimWindow(new Date(input.expenseDate));
  if (!receipt) throw ApiError.badRequest('Attach the receipt for this expense');

  if (input.category === REIMBURSEMENT_CATEGORY.TRAVEL && !input.travelMode) {
    throw ApiError.badRequest('Select whether this travel was cab (Ola/Rapido/Uber) or bike/petrol.');
  }

  const reimbursement = await reimbursementRepository.create({
    employee: employeeId,
    category: input.category,
    travelMode: input.category === REIMBURSEMENT_CATEGORY.TRAVEL ? input.travelMode : undefined,
    client: input.category === REIMBURSEMENT_CATEGORY.CLIENT_WORK ? input.client : undefined,
    // The client's name as typed — any category can carry one.
    clientBrandName: input.clientBrandName?.trim() || undefined,
    expenseDate: input.expenseDate,
    receiptFile: { data: receipt.buffer, contentType: receipt.mimetype, filename: receipt.originalname },
    description: input.description,
    peopleInvolved: input.peopleInvolved || [],
    amount: input.amount,
  });

  const employeeName = `${employee.firstName} ${employee.lastName || ''}`.trim();
  const financeUsers = await userRepository.findFinanceUsers();
  if (financeUsers.length > 0) {
    await notificationService.createForUsers(financeUsers.map((u) => u._id), {
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

// Finance-only — admin/ceo/cfo/finance (see requireFinanceAccess at the route).
// Nobody decides their own claim.
function assertNotOwnClaim(existing, actingUser) {
  if (actingUser?.employeeLink && String(existing.employee?._id ?? existing.employee) === actingUser.employeeLink) {
    throw ApiError.forbidden('This is your own claim — someone else in Finance has to decide it');
  }
}

async function approve(id, actingUser) {
  const existing = await reimbursementRepository.findById(id);
  if (!existing) throw ApiError.notFound('Reimbursement not found');
  assertNotOwnClaim(existing, actingUser);
  if (existing.status !== REIMBURSEMENT_STATUS.PENDING) {
    throw ApiError.conflict('This reimbursement has already been decided');
  }

  // Finance's approval sends it on to the CEO/admin for the final say.
  const updated = await reimbursementRepository.updateById(id, {
    status: REIMBURSEMENT_STATUS.AWAITING_CEO,
    approvedBy: actingUser.id,
    approvedAt: new Date(),
  });
  const approvers = await userRepository.findPayoutApprovers();
  const employeeName = `${updated.employee.firstName} ${updated.employee.lastName || ''}`.trim();
  await notificationService.createForUsers(
    approvers.map((u) => u._id),
    {
      type: NOTIFICATION_TYPES.REIMBURSEMENT_AWAITING_CEO,
      title: 'Reimbursement needs your approval',
      message: `${employeeName} — ₹${updated.amount.toLocaleString('en-IN')} for ${updated.category.replace(/_/g, ' ')}. Finance has approved it.`,
      employee: updated.employee._id,
      reimbursement: updated._id,
    }
  );
  await notifyEmployee(updated, NOTIFICATION_TYPES.REIMBURSEMENT_AWAITING_CEO, 'Reimbursement approved by Finance', 'Finance approved your reimbursement claim — it now needs the CEO\'s approval.');
  return updated;
}

// The CEO's or admin's final approval — only now is the claim payable.
async function ceoApprove(id, actingUser) {
  const existing = await reimbursementRepository.findById(id);
  if (!existing) throw ApiError.notFound('Reimbursement not found');
  assertNotOwnClaim(existing, actingUser);
  if (existing.status !== REIMBURSEMENT_STATUS.AWAITING_CEO) {
    throw ApiError.conflict(
      existing.status === REIMBURSEMENT_STATUS.PENDING ? 'Finance has not approved this claim yet' : 'This reimbursement has already been decided'
    );
  }

  const updated = await reimbursementRepository.updateById(id, {
    status: REIMBURSEMENT_STATUS.APPROVED,
    ceoApprovedBy: actingUser.id,
    ceoApprovedAs: accessService.actingRole(actingUser, GRANTS[ACCESS.PAYOUT_APPROVAL]),
    ceoApprovedAt: new Date(),
  });
  const payday = fmtPayout(payoutMonday(updated.expenseDate));
  await notifyEmployee(updated, NOTIFICATION_TYPES.REIMBURSEMENT_APPROVED, 'Reimbursement approved', `Your reimbursement claim was approved — it will be paid on ${payday}.`);
  return updated;
}

async function ceoReject(id, reason, actingUser) {
  const existing = await reimbursementRepository.findById(id);
  if (!existing) throw ApiError.notFound('Reimbursement not found');
  assertNotOwnClaim(existing, actingUser);
  if (existing.status !== REIMBURSEMENT_STATUS.AWAITING_CEO) {
    throw ApiError.conflict('This reimbursement is not waiting for the final approval');
  }
  const updated = await reimbursementRepository.updateById(id, {
    status: REIMBURSEMENT_STATUS.REJECTED,
    ceoApprovedBy: actingUser.id,
    ceoApprovedAs: accessService.actingRole(actingUser, GRANTS[ACCESS.PAYOUT_APPROVAL]),
    ceoApprovedAt: new Date(),
    rejectionReason: reason,
    rejectedStage: 'ceo',
  });
  await notifyEmployee(updated, NOTIFICATION_TYPES.REIMBURSEMENT_REJECTED, 'Reimbursement rejected', `Your reimbursement claim was rejected: ${reason}`);
  return updated;
}

// Claims Finance has approved that are waiting on the CEO/admin.
async function listAwaitingCeo(actingUser) {
  const claims = await reimbursementRepository.listAll({ status: REIMBURSEMENT_STATUS.AWAITING_CEO });
  return claims.map((c) => {
    const plain = c.toObject();
    // Their own claim — someone else has to decide it.
    return { ...plain, isOwn: Boolean(actingUser?.employeeLink && String(plain.employee?._id) === actingUser.employeeLink) };
  });
}

async function reject(id, reason, actingUser) {
  const existing = await reimbursementRepository.findById(id);
  if (!existing) throw ApiError.notFound('Reimbursement not found');
  assertNotOwnClaim(existing, actingUser);
  if (existing.status !== REIMBURSEMENT_STATUS.PENDING) {
    throw ApiError.conflict('This reimbursement has already been decided');
  }

  const updated = await reimbursementRepository.updateById(id, {
    status: REIMBURSEMENT_STATUS.REJECTED,
    approvedBy: actingUser.id,
    approvedAt: new Date(),
    rejectionReason: reason,
    rejectedStage: 'finance',
  });
  await notifyEmployee(updated, NOTIFICATION_TYPES.REIMBURSEMENT_REJECTED, 'Reimbursement rejected', `Your reimbursement claim was rejected: ${reason}`);
  return updated;
}

// requireFinanceAccess-gated, only from 'approved' — normally happens as
// part of the Monday payment batch (see jobs/reimbursementPaymentReminder.job.js)
// but nothing stops paying one off-cycle if it's genuinely ready.
// A screenshot of the payment is required — it is what the claimant sees as
// proof on their dashboard.
async function markPaid(id, transactionDetails, actingUser, proofFile) {
  const existing = await reimbursementRepository.findById(id);
  if (!existing) throw ApiError.notFound('Reimbursement not found');
  assertNotOwnClaim(existing, actingUser);
  if (existing.status !== REIMBURSEMENT_STATUS.APPROVED) {
    throw ApiError.conflict('Only an approved reimbursement can be marked paid');
  }
  if (!proofFile) throw ApiError.badRequest('Attach a screenshot of the payment to mark this paid');

  const updated = await reimbursementRepository.updateById(id, {
    status: REIMBURSEMENT_STATUS.PAID,
    paidAt: new Date(),
    paidBy: actingUser.id,
    transactionDetails,
    paymentProofFile: { data: proofFile.buffer, contentType: proofFile.mimetype, filename: proofFile.originalname },
  });
  await notifyEmployee(updated, NOTIFICATION_TYPES.REIMBURSEMENT_PAID, 'Reimbursement paid', 'Your reimbursement claim has been paid.');
  return updated;
}

// Self-only, once Finance is done with it (paid or rejected).
async function acknowledge(id, employeeId) {
  const existing = await reimbursementRepository.findById(id);
  if (!existing || String(existing.employee?._id ?? existing.employee) !== employeeId) {
    throw ApiError.notFound('Reimbursement not found');
  }
  if (![REIMBURSEMENT_STATUS.PAID, REIMBURSEMENT_STATUS.REJECTED].includes(existing.status)) {
    throw ApiError.conflict('Only a paid or rejected claim can be acknowledged');
  }
  if (existing.acknowledgedAt) return existing;
  return reimbursementRepository.updateById(id, { acknowledgedAt: new Date() });
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

module.exports = {
  fileReimbursement,
  attachReceipt,
  listMine,
  listAll,
  listAwaitingCeo,
  approve,
  ceoApprove,
  ceoReject,
  reject,
  markPaid,
  acknowledge,
  assertClaimWindow,
  weekMondayStart,
  payoutMonday,
};
