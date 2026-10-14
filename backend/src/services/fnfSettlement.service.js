const fs = require('node:fs/promises');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const env = require('../config/env');
const FnfSettlement = require('../models/FnfSettlement');
const SalarySlip = require('../models/SalarySlip');
const fnfSettlementRepository = require('../repositories/fnfSettlement.repository');
const generatedDocumentRepository = require('../repositories/generatedDocument.repository');
const employeeRepository = require('../repositories/employee.repository');
const userRepository = require('../repositories/user.repository');
const localFileStorage = require('./localFileStorage.service');
const emailService = require('./email.service');
const notificationService = require('./notification.service');
const accessService = require('./access.service');
const { companyEmailOf } = require('../utils/companyEmail');
const { can, isSelf } = require('../utils/roles');
const { ACCESS, GRANTS } = require('../config/access');
const { NOTIFICATION_TYPES, FNF_STAGE, SALARY_SLIP_APPROVAL } = require('../config/constants');

// Full & final settlement, from the document to the payment:
//
//   FnF document generated (EMS → Generate documents)
//     -> HR confirms the last working day (pre-filled from the employee's
//        record, else the document's separation date)
//     -> the final salary slip is generated, up to that day
//     -> the CEO/admin approves the settlement and its slip together
//        (or sends it back to HR with a note)
//     -> Finance is mailed the document and the slip, and pays the total
//        (final salary + the document's severance) with a receipt
//     -> the receipt is mailed to the employee
//
// Settlements from before this flow have no stage and go straight to Finance
// as they always did.

const { HR, CEO, FINANCE } = FNF_STAGE;
const SLIP_NAMESPACE = 'salary-slips';
const POPULATE = [
  { path: 'employee', select: 'firstName lastName employeeCode designation personalEmail endDate extraDetails status' },
  { path: 'salarySlip', select: 'startDate endDate netPayable approvalStatus paymentStatus generatedFile' },
];

const nameOf = (employee) => `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim();
const rupees = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dayStr = (d) => new Date(d).toISOString().slice(0, 10);
const prettyDay = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const todayUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
const parseDay = (value) => {
  if (!value) return null;
  const d = new Date(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

function financeFrom() {
  const match = /<([^>]+)>/.exec(env.resend.fromEmail || '');
  const address = match ? match[1] : env.resend.fromEmail;
  return `Finance <${address}>`;
}

// The settlement's money: the final salary slip plus the document's severance.
function totals(settlement) {
  const finalSalary = settlement.salarySlip?.netPayable || 0;
  const severance = Number(settlement.amount) || 0;
  return { finalSalary, severance, total: Math.round((finalSalary + severance) * 100) / 100 };
}

function shape(settlement) {
  const plain = typeof settlement.toObject === 'function' ? settlement.toObject() : settlement;
  const employee = plain.employee || {};
  const { extraDetails, ...employeeRest } = employee;
  // The last day HR is asked to confirm: their record's, else the document's.
  const suggestedLastDay = plain.lastWorkingDay || employee.endDate || plain.separationDate || null;
  return {
    ...plain,
    employee: employeeRest,
    companyEmail: companyEmailOf(employee),
    suggestedLastDay,
    ...totals(plain),
  };
}

// Called from docGeneration.service.js right after an 'fnf-settlement'
// document is generated — it now starts with HR.
async function createFromGeneratedDocument(generatedDocument, employeeId, rawSeveranceAmount, rawSeparationDate) {
  const amount = Number(rawSeveranceAmount);
  const settlement = await fnfSettlementRepository.create({
    employee: employeeId,
    generatedDocument: generatedDocument._id,
    amount: Number.isFinite(amount) ? amount : undefined,
    separationDate: parseDay(rawSeparationDate) || undefined,
    stage: HR,
  });
  const [employee, hrUsers] = await Promise.all([employeeRepository.findById(String(employeeId)), userRepository.findHr()]);
  await notificationService.createForUsers(
    hrUsers.map((u) => u._id),
    {
      type: NOTIFICATION_TYPES.FNF_PENDING_HR,
      title: 'Full & final: confirm the last working day',
      message: `${nameOf(employee)}'s full & final settlement document was generated — confirm their last working day so the final salary slip can be made.`,
      employee: employeeId,
      fnfSettlement: settlement._id,
    }
  );
  return settlement;
}

async function load(id) {
  const settlement = await FnfSettlement.findById(id).populate(POPULATE);
  if (!settlement) throw ApiError.notFound('Full & final settlement not found');
  return settlement;
}

// HR's queue (also the CEO's/admin's, who sit above HR).
async function listForHr() {
  const list = await FnfSettlement.find({ stage: HR }).sort({ createdAt: 1 }).populate(POPULATE);
  return list.map(shape);
}

// HR confirms the last working day; the final salary slip is generated up to
// it and the settlement goes to the CEO/admin.
async function confirmLastDay(id, { lastWorkingDay }, actor) {
  const settlement = await load(id);
  if (settlement.stage !== HR) throw ApiError.conflict('This settlement is not waiting for the last working day');
  if (isSelf(actor, settlement.employee._id)) throw ApiError.forbidden("This is your own settlement — someone else has to handle it");
  const lastDay = parseDay(lastWorkingDay);
  if (!lastDay) throw ApiError.badRequest('Choose the last working day');
  if (lastDay.getTime() > todayUTC().getTime()) {
    throw ApiError.badRequest('The last working day has not come yet — confirm it once it has passed, so the final slip covers every day');
  }

  // The record keeps the last day (it decides the final slip — see
  // salaryCalculation.service.js#clipToEmployment).
  await employeeRepository.updateById(String(settlement.employee._id), { endDate: lastDay });

  // From the start of that month (or the joining date) to the last day.
  const monthStart = new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), 1));
  // Required lazily: salarySlip.service is the bigger module and pulls in a lot.
  const salarySlipService = require('./salarySlip.service');
  const slip = await salarySlipService.generateSlip(
    String(settlement.employee._id),
    { startDate: dayStr(monthStart), endDate: dayStr(lastDay) },
    actor.id,
    actor
  );
  await SalarySlip.updateOne({ _id: slip._id }, { fnfSettlement: settlement._id });
  // An earlier final slip (from a send-back) no longer counts.
  if (settlement.salarySlip && String(settlement.salarySlip._id) !== String(slip._id)) {
    await SalarySlip.updateOne({ _id: settlement.salarySlip._id, approvalStatus: { $ne: SALARY_SLIP_APPROVAL.APPROVED } }, { approvalStatus: SALARY_SLIP_APPROVAL.SUPERSEDED });
  }

  settlement.lastWorkingDay = lastDay;
  settlement.salarySlip = slip._id;
  settlement.stage = CEO;
  settlement.hrConfirmedBy = actor.id;
  settlement.hrConfirmedAs = accessService.actingRole(actor, GRANTS[ACCESS.HRMS]);
  settlement.hrConfirmedAt = new Date();
  settlement.sendBackNote = undefined;
  await settlement.save();

  const approvers = await userRepository.findPayoutApprovers();
  const fresh = await load(id);
  const { total } = totals(fresh);
  await notificationService.createForUsers(
    approvers.map((u) => u._id),
    {
      type: NOTIFICATION_TYPES.FNF_PENDING_CEO,
      title: 'Full & final settlement needs your approval',
      message: `${nameOf(fresh.employee)} — last working day ${prettyDay(lastDay)}, total ${rupees(total)} (final salary + severance).`,
      employee: fresh.employee._id,
      fnfSettlement: fresh._id,
    }
  );
  return shape(fresh);
}

// The CEO's/admin's queue.
async function listForApproval(actor) {
  const list = await FnfSettlement.find({ stage: CEO }).sort({ hrConfirmedAt: 1 }).populate(POPULATE);
  return list.map((s) => ({ ...shape(s), isOwn: isSelf(actor, s.employee?._id) }));
}

async function mailFinance(settlement) {
  const to = env.financeSalaryEmail;
  if (!to) return { status: 'failed', error: 'No Finance address is configured' };
  if (!env.resendConfigured) return { to, status: 'failed', error: 'Email is not set up on the server' };
  try {
    const name = nameOf(settlement.employee);
    const { finalSalary, severance, total } = totals(settlement);
    const attachments = [];
    const document = await generatedDocumentRepository.findByIdWithFile(settlement.generatedDocument);
    if (document?.pdf?.data) attachments.push({ filename: `Full and Final Settlement - ${name}.pdf`, content: document.pdf.data });
    if (settlement.salarySlip?.generatedFile?.filePath) {
      const pdf = await fs.readFile(localFileStorage.absolutePathFor(settlement.salarySlip.generatedFile.filePath, SLIP_NAMESPACE));
      attachments.push({ filename: `Final Salary Slip - ${name}.pdf`, content: pdf });
    }
    await emailService.sendEmail({
      to,
      subject: `Full & final settlement approved — ${name}`,
      html: `<p>Hello,</p>
<p>The full &amp; final settlement for <strong>${name}</strong>${settlement.employee.employeeCode ? ` (${settlement.employee.employeeCode})` : ''} has been approved for payment.</p>
<p><strong>Last working day:</strong> ${prettyDay(settlement.lastWorkingDay)}<br/>
<strong>Final salary (slip attached):</strong> ${rupees(finalSalary)}<br/>
<strong>Severance (settlement document attached):</strong> ${rupees(severance)}<br/>
<strong>Total to pay:</strong> ${rupees(total)}</p>
<p>It is in the Finance tab under FnF, where the payment is marked paid with its receipt.</p>
<p>Thanks,<br/>HR — ${env.companyName || 'GO-TO Friend'}</p>`,
      text: `Full & final settlement approved for ${name}. Last working day ${prettyDay(settlement.lastWorkingDay)}. Final salary ${rupees(finalSalary)} + severance ${rupees(severance)} = ${rupees(total)}.`,
      attachments,
    });
    return { to, status: 'sent' };
  } catch (err) {
    logger.error({ err, settlement: settlement._id }, 'Could not mail the full & final settlement to Finance');
    return { to, status: 'failed', error: err.message || 'Could not be sent' };
  }
}

// Approves the settlement and its final slip together, then hands it to
// Finance (by mail and in the Finance tab).
async function approve(id, actor) {
  const settlement = await load(id);
  if (settlement.stage !== CEO) throw ApiError.conflict('This settlement is not waiting for approval');
  if (isSelf(actor, settlement.employee._id)) throw ApiError.forbidden('This is your own settlement — someone else has to approve it');
  if (!settlement.salarySlip || settlement.salarySlip.approvalStatus !== SALARY_SLIP_APPROVAL.PENDING) {
    throw ApiError.conflict('The final salary slip was replaced — send this back to HR to make it again');
  }

  const decidedAs = accessService.actingRole(actor, GRANTS[ACCESS.PAYOUT_APPROVAL]);
  // Marked first, so a second click can't mail Finance twice.
  settlement.stage = FINANCE;
  settlement.ceoDecidedBy = actor.id;
  settlement.ceoDecidedAs = decidedAs;
  settlement.ceoDecidedAt = new Date();
  await settlement.save();
  await SalarySlip.updateOne(
    { _id: settlement.salarySlip._id },
    { approvalStatus: SALARY_SLIP_APPROVAL.APPROVED, approvedBy: actor.id, approvedAs: decidedAs, approvedAt: new Date() }
  );

  settlement.financeEmail = await mailFinance(settlement);
  await settlement.save();

  const financeUsers = await userRepository.findFinanceUsers();
  const { total } = totals(settlement);
  await notificationService.createForUsers(
    financeUsers.map((u) => u._id),
    {
      type: NOTIFICATION_TYPES.FNF_APPROVED,
      title: 'Full & final settlement to pay',
      message: `${nameOf(settlement.employee)}'s full & final settlement (${rupees(total)}) is approved — see Finance → FnF.`,
      employee: settlement.employee._id,
      fnfSettlement: settlement._id,
    }
  );
  return shape(await load(id));
}

// Back to HR with a note — HR confirms the last day again, which makes a new final slip.
async function sendBack(id, note, actor) {
  const settlement = await load(id);
  if (settlement.stage !== CEO) throw ApiError.conflict('This settlement is not waiting for approval');
  if (settlement.salarySlip) {
    await SalarySlip.updateOne({ _id: settlement.salarySlip._id, approvalStatus: SALARY_SLIP_APPROVAL.PENDING }, { approvalStatus: SALARY_SLIP_APPROVAL.REJECTED });
  }
  settlement.stage = HR;
  settlement.sendBackNote = note;
  settlement.ceoDecidedBy = actor.id;
  settlement.ceoDecidedAs = accessService.actingRole(actor, GRANTS[ACCESS.PAYOUT_APPROVAL]);
  settlement.ceoDecidedAt = new Date();
  await settlement.save();

  const hrUsers = await userRepository.findHr();
  await notificationService.createForUsers(
    hrUsers.map((u) => u._id).filter((uid) => String(uid) !== String(actor.id)),
    {
      type: NOTIFICATION_TYPES.FNF_SENT_BACK,
      title: 'Full & final settlement sent back',
      message: `${nameOf(settlement.employee)}'s full & final settlement was sent back: ${note}`,
      employee: settlement.employee._id,
      fnfSettlement: settlement._id,
    }
  );
  return shape(await load(id));
}

// Finance's list: approved settlements, plus older ones from before this flow.
async function listAll() {
  const list = await FnfSettlement.find({ $or: [{ stage: FINANCE }, { stage: { $exists: false } }, { stage: null }] })
    .sort({ createdAt: -1 })
    .populate(POPULATE);
  return list.map(shape);
}

function fnfPaidEmailHtml(settlement, transactionDetails) {
  const employeeName = nameOf(settlement.employee);
  const { finalSalary, severance, total } = totals(settlement);
  const hasSlip = Boolean(settlement.salarySlip);
  return `<p>Hi ${employeeName},</p>
<p>Your Full &amp; Final settlement has been paid. The payment receipt and the settlement document are attached.</p>
<p>${hasSlip ? `<strong>Final salary:</strong> ${rupees(finalSalary)}<br/><strong>Severance:</strong> ${rupees(severance)}<br/>` : ''}<strong>Amount paid:</strong> ${rupees(hasSlip ? total : settlement.amount)}<br/>
<strong>Payment mode:</strong> ${transactionDetails.mode || '—'}<br/>
<strong>Reference number:</strong> ${transactionDetails.referenceNumber || '—'}<br/>
<strong>Paid on:</strong> ${transactionDetails.paidOn ? new Date(transactionDetails.paidOn).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}</p>
${transactionDetails.note ? `<p>${transactionDetails.note}</p>` : ''}
<p>Thanks,<br/>Finance</p>`;
}

// Finance pays the whole settlement (final salary + severance) with a
// receipt, which is mailed to the employee — their company mail and their
// personal one, since they have left. The final slip is marked paid with it.
async function markPaid(id, transactionDetails, actingUser, receipt) {
  const settlement = await load(id);
  if (settlement.stage && settlement.stage !== FINANCE) throw ApiError.conflict('This settlement has not been approved yet');
  if (settlement.status === 'paid') throw ApiError.conflict('This FnF settlement is already marked paid');
  if (!receipt) throw ApiError.badRequest('Attach the payment receipt to mark this settlement paid');

  const receiptFile = { data: receipt.buffer, contentType: receipt.mimetype, filename: receipt.originalname };
  await FnfSettlement.updateOne(
    { _id: settlement._id },
    { status: 'paid', paidAt: new Date(), paidBy: actingUser.id, transactionDetails, paymentReceiptFile: receiptFile }
  );
  if (settlement.salarySlip) {
    await SalarySlip.updateOne(
      { _id: settlement.salarySlip._id },
      { paymentStatus: 'paid', paidAt: new Date(), paidBy: actingUser.id, transactionDetails, paymentReceiptFile: receiptFile, paidSeenByEmployee: true }
    );
  }

  const fresh = await load(id);
  const document = await generatedDocumentRepository.findByIdWithFile(fresh.generatedDocument);
  const attachments = [{ filename: receipt.originalname || 'payment-receipt', content: receipt.buffer }];
  if (document?.pdf?.data) attachments.push({ filename: document.pdf.filename || 'fnf-settlement.pdf', content: document.pdf.data });
  const recipients = [...new Set([companyEmailOf(fresh.employee), fresh.employee?.personalEmail].filter(Boolean))];
  if (recipients.length) {
    await emailService
      .sendEmail({
        to: recipients,
        subject: 'Your Full & Final settlement has been paid',
        html: fnfPaidEmailHtml(fresh, transactionDetails),
        from: financeFrom(),
        attachments,
      })
      .catch((err) => logger.error({ err, settlement: fresh._id }, 'Could not mail the full & final payment receipt'));
  }

  const employeeUser = await userRepository.findByEmployeeId(fresh.employee._id);
  if (employeeUser) {
    await notificationService.createForUsers([employeeUser._id], {
      type: NOTIFICATION_TYPES.FNF_SETTLEMENT_PAID,
      title: 'FnF settlement paid',
      message: 'Your Full & Final settlement has been paid — the receipt was sent to your mail.',
      employee: fresh.employee._id,
      fnfSettlement: fresh._id,
    });
  }
  return shape(fresh);
}

// The settlement document — for HR, the CEO/admin and Finance.
async function getDocumentFile(id, viewer) {
  if (!can(viewer, ACCESS.HRMS) && !can(viewer, ACCESS.PAYOUT_APPROVAL) && !can(viewer, ACCESS.FINANCE)) throw ApiError.forbidden();
  const settlement = await FnfSettlement.findById(id);
  if (!settlement) throw ApiError.notFound('Full & final settlement not found');
  const document = await generatedDocumentRepository.findByIdWithFile(settlement.generatedDocument);
  if (!document?.pdf?.data) throw ApiError.notFound('The settlement document has no PDF on file');
  return { data: document.pdf.data, contentType: 'application/pdf', filename: document.pdf.filename || 'fnf-settlement.pdf' };
}

// The final salary slip — for HR, the CEO/admin and Finance.
async function getSlipFilePath(id, viewer) {
  if (!can(viewer, ACCESS.HRMS) && !can(viewer, ACCESS.PAYOUT_APPROVAL) && !can(viewer, ACCESS.FINANCE)) throw ApiError.forbidden();
  const settlement = await FnfSettlement.findById(id).populate('salarySlip', 'generatedFile');
  if (!settlement?.salarySlip?.generatedFile?.filePath) throw ApiError.notFound('No final salary slip yet');
  return localFileStorage.absolutePathFor(settlement.salarySlip.generatedFile.filePath, SLIP_NAMESPACE);
}

// Finance's receipt — Finance, and the employee it was paid to.
async function getReceipt(id, viewer) {
  const settlement = await FnfSettlement.findById(id).select('+paymentReceiptFile.data');
  if (!settlement) throw ApiError.notFound('Full & final settlement not found');
  if (!isSelf(viewer, settlement.employee) && !can(viewer, ACCESS.FINANCE)) throw ApiError.forbidden();
  if (!settlement.paymentReceiptFile?.data) throw ApiError.notFound('No payment receipt on file');
  return settlement.paymentReceiptFile;
}

module.exports = {
  createFromGeneratedDocument,
  listForHr,
  confirmLastDay,
  listForApproval,
  approve,
  sendBack,
  listAll,
  markPaid,
  getDocumentFile,
  getSlipFilePath,
  getReceipt,
};
