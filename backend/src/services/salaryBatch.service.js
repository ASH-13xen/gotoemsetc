const fs = require('node:fs/promises');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const env = require('../config/env');
const SalaryBatch = require('../models/SalaryBatch');
const SalarySlip = require('../models/SalarySlip');
const employeeRepository = require('../repositories/employee.repository');
const userRepository = require('../repositories/user.repository');
const localFileStorage = require('./localFileStorage.service');
const salarySlipService = require('./salarySlip.service');
const emailService = require('./email.service');
const notificationService = require('./notification.service');
const accessService = require('./access.service');
const { companyEmailOf } = require('../utils/companyEmail');
const { ACCESS, GRANTS } = require('../config/access');
const { SALARY_BATCH_STATUS, SALARY_BATCH_KIND, SALARY_SLIP_APPROVAL, NOTIFICATION_TYPES } = require('../config/constants');

// Salary slips wait for the CEO or admin before they go anywhere.
//
//   HR generates  ->  batch "pending"  ->  CEO/admin: Approve all
//        each employee is mailed their own slip (company mail id)
//        Finance is mailed the master salary sheet
//        the slips now show in the Finance tab and to the employees
//   …or the CEO/admin sends it back with a note, and HR generates again.
//
// A newer slip for the same person and month replaces an older one that is
// still waiting, so nothing stale can be approved.

const { PENDING, APPROVED, SENT_BACK, SUPERSEDED } = SALARY_BATCH_STATUS;
const SLIP_NAMESPACE = 'salary-slips';
// Resend allows two requests a second — leave room between mails.
const MAIL_GAP_MS = 600;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const nameOf = (employee) => `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim();
const periodLabel = (batch) => new Date(Date.UTC(batch.year, batch.month - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const rupees = (n) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthBounds = (year, month) => ({ $gte: new Date(Date.UTC(year, month - 1, 1)), $lt: new Date(Date.UTC(year, month, 1)) });

// Called right after HR generates — one slip from an employee's page, or the
// whole month from HR Work.
async function openBatch({ kind, month, year, slipIds }, actor) {
  if (!slipIds || slipIds.length === 0) return null;
  const slips = await SalarySlip.find({ _id: { $in: slipIds } }).select('employee');

  // An older slip for the same person and month that is still waiting is
  // replaced by this one.
  await SalarySlip.updateMany(
    {
      _id: { $nin: slipIds },
      employee: { $in: slips.map((s) => s.employee) },
      startDate: monthBounds(year, month),
      approvalStatus: SALARY_SLIP_APPROVAL.PENDING,
    },
    { approvalStatus: SALARY_SLIP_APPROVAL.SUPERSEDED }
  );

  const batch = await SalaryBatch.create({
    kind,
    month,
    year,
    slips: slipIds,
    createdBy: actor?.id,
    createdAs: actor ? accessService.actingRole(actor, GRANTS[ACCESS.EMS_ALL]) : undefined,
  });
  await SalarySlip.updateMany({ _id: { $in: slipIds } }, { batch: batch._id });
  await closeEmptyBatches();

  const approvers = await userRepository.findPayoutApprovers();
  await notificationService.createForUsers(
    approvers.map((u) => u._id),
    {
      type: NOTIFICATION_TYPES.SALARY_BATCH_PENDING,
      title: 'Salary slips need your approval',
      message:
        kind === SALARY_BATCH_KIND.BULK
          ? `${slipIds.length} salary slips for ${periodLabel(batch)} are waiting for your approval.`
          : `A salary slip for ${periodLabel(batch)} is waiting for your approval.`,
    }
  );
  return batch;
}

// A waiting batch whose slips have all been replaced has nothing left to approve.
async function closeEmptyBatches() {
  const waiting = await SalaryBatch.find({ status: PENDING }).select('slips');
  for (const batch of waiting) {
    // eslint-disable-next-line no-await-in-loop
    const live = await SalarySlip.countDocuments({ _id: { $in: batch.slips }, approvalStatus: SALARY_SLIP_APPROVAL.PENDING });
    // eslint-disable-next-line no-await-in-loop
    if (live === 0) await SalaryBatch.updateOne({ _id: batch._id }, { status: SUPERSEDED });
  }
}

async function shape(batch, actor) {
  const slips = await SalarySlip.find({ _id: { $in: batch.slips }, approvalStatus: batch.status === PENDING ? SALARY_SLIP_APPROVAL.PENDING : { $ne: SALARY_SLIP_APPROVAL.SUPERSEDED } })
    .populate('employee', 'firstName lastName employeeCode designation extraDetails')
    .sort({ createdAt: 1 });
  const rows = slips
    .map((s) => ({
      _id: s._id,
      employeeId: s.employee?._id,
      employeeName: nameOf(s.employee),
      employeeCode: s.employee?.employeeCode || '',
      designation: s.employee?.designation || '',
      startDate: s.startDate,
      endDate: s.endDate,
      netPayable: s.netPayable || 0,
      // Shown before approving, so a missing mailbox can be fixed first.
      companyEmail: companyEmailOf(s.employee),
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  const [shaped] = await accessService.shapeAttribution(actor, [batch], [
    { by: 'createdBy', as: 'createdAs' },
    { by: 'decidedBy', as: 'decidedAs' },
  ]);
  return {
    ...shaped,
    periodLabel: periodLabel(batch),
    slips: rows,
    slipCount: rows.length,
    totalNetPayable: Math.round(rows.reduce((t, r) => t + r.netPayable, 0) * 100) / 100,
    withoutCompanyEmail: rows.filter((r) => !r.companyEmail).length,
  };
}

// The CEO's/admin's box: what is waiting, and — so a mail that could not be
// sent isn't lost — the batches approved in the last two weeks.
async function listForApprover(actor) {
  await closeEmptyBatches();
  const [pending, recent] = await Promise.all([
    SalaryBatch.find({ status: PENDING }).sort({ createdAt: 1 }),
    SalaryBatch.find({ status: APPROVED, decidedAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } })
      .sort({ decidedAt: -1 })
      .limit(5),
  ]);
  return {
    pending: await Promise.all(pending.map((b) => shape(b, actor))),
    recent: await Promise.all(recent.map((b) => shape(b, actor))),
  };
}

function slipEmailHtml(employee, slip, label) {
  return `<p>Hi ${employee.firstName || ''},</p>
<p>Your salary slip for <strong>${label}</strong> is attached.</p>
<p><strong>Net payable:</strong> ${rupees(slip.netPayable)}</p>
<p>You will get a separate mail once the payment is made. If anything on the slip looks wrong, please tell HR.</p>
<p>Thanks,<br/>HR — ${env.companyName || 'GO-TO Friend'}</p>`;
}

async function mailSlip(slip, label) {
  const employee = await employeeRepository.findById(String(slip.employee));
  const result = { slip: slip._id, employee: slip.employee, employeeName: nameOf(employee) || 'Unknown employee' };
  const to = companyEmailOf(employee);
  if (!to) return { ...result, status: 'no_address', error: 'No Company Mail ID on their record' };
  if (!env.resendConfigured) return { ...result, to, status: 'failed', error: 'Email is not set up on the server' };
  try {
    const pdf = await fs.readFile(localFileStorage.absolutePathFor(slip.generatedFile.filePath, SLIP_NAMESPACE));
    await emailService.sendEmail({
      to,
      subject: `Your salary slip for ${label}`,
      html: slipEmailHtml(employee, slip, label),
      text: `Hi ${employee.firstName || ''},\n\nYour salary slip for ${label} is attached. Net payable: ${rupees(slip.netPayable)}.\n\nThanks,\nHR`,
      attachments: [{ filename: `Salary Slip - ${label} - ${result.employeeName}.pdf`, content: pdf }],
    });
    return { ...result, to, status: 'sent' };
  } catch (err) {
    logger.error({ err, slip: slip._id }, 'Could not mail salary slip');
    return { ...result, to, status: 'failed', error: err.message || 'Could not be sent' };
  }
}

// Finance gets the month's master sheet — the approved slips only — and
// nobody else does.
async function mailMasterSheet(batch, approvedCount, totalNet) {
  const to = env.financeSalaryEmail;
  if (!to) return { status: 'failed', error: 'No Finance address is configured' };
  if (!env.resendConfigured) return { to, status: 'failed', error: 'Email is not set up on the server' };
  const label = periodLabel(batch);
  try {
    const pdf = await salarySlipService.buildMasterSheet({ month: batch.month, year: batch.year }, { approvedOnly: true });
    const updated = batch.kind === SALARY_BATCH_KIND.SINGLE;
    await emailService.sendEmail({
      to,
      subject: `${updated ? 'Updated master' : 'Master'} salary sheet — ${label}`,
      html: `<p>Hello,</p>
<p>The ${updated ? 'updated ' : ''}master salary sheet for <strong>${label}</strong> is attached. ${
        updated ? `A salary slip was approved after the month's sheet went out — this replaces it.` : `It has been approved for payment.`
      }</p>
<p><strong>Slips approved now:</strong> ${approvedCount} &nbsp;·&nbsp; <strong>Their net payable:</strong> ${rupees(totalNet)}</p>
<p>The slips are in the Finance tab under Salary, where each payment can be marked paid with its receipt.</p>
<p>Thanks,<br/>HR — ${env.companyName || 'GO-TO Friend'}</p>`,
      text: `The ${updated ? 'updated ' : ''}master salary sheet for ${label} is attached. Slips approved now: ${approvedCount}. Net payable: ${rupees(totalNet)}.`,
      attachments: [{ filename: `Master Salary Sheet - ${batch.year}-${String(batch.month).padStart(2, '0')}.pdf`, content: pdf }],
    });
    return { to, status: 'sent' };
  } catch (err) {
    logger.error({ err, batch: batch._id }, 'Could not mail master salary sheet');
    return { to, status: 'failed', error: err.message || 'Could not be sent' };
  }
}

async function loadPending(id) {
  const batch = await SalaryBatch.findById(id);
  if (!batch) throw ApiError.notFound('Salary batch not found');
  if (batch.status !== PENDING) throw ApiError.conflict('These salary slips have already been decided');
  return batch;
}

// Approve all: every slip in the batch at once.
async function approve(id, actor) {
  const batch = await loadPending(id);
  const slips = await SalarySlip.find({ _id: { $in: batch.slips }, approvalStatus: SALARY_SLIP_APPROVAL.PENDING });
  if (slips.length === 0) {
    await SalaryBatch.updateOne({ _id: batch._id }, { status: SUPERSEDED });
    throw ApiError.conflict('Every slip in this batch has been replaced by a newer one');
  }

  const decidedAs = accessService.actingRole(actor, GRANTS[ACCESS.PAYOUT_APPROVAL]);
  // Marked first, so a second click (or a second approver) can't send the
  // mails twice while the first run is still going.
  batch.status = APPROVED;
  batch.decidedBy = actor.id;
  batch.decidedAs = decidedAs;
  batch.decidedAt = new Date();
  await batch.save();
  await SalarySlip.updateMany(
    { _id: { $in: slips.map((s) => s._id) } },
    { approvalStatus: SALARY_SLIP_APPROVAL.APPROVED, approvedBy: actor.id, approvedAs: decidedAs, approvedAt: new Date() }
  );

  const label = periodLabel(batch);
  const emailResults = [];
  for (const slip of slips) {
    // eslint-disable-next-line no-await-in-loop
    const result = await mailSlip(slip, label);
    emailResults.push(result);
    // eslint-disable-next-line no-await-in-loop
    await SalarySlip.updateOne({ _id: slip._id }, { slipEmail: { to: result.to, status: result.status, error: result.error, at: new Date() } });
    // eslint-disable-next-line no-await-in-loop
    if (result.status === 'sent') await sleep(MAIL_GAP_MS);
  }
  const totalNet = slips.reduce((t, s) => t + (s.netPayable || 0), 0);
  batch.emailResults = emailResults;
  batch.masterSheetEmail = await mailMasterSheet(batch, slips.length, totalNet);
  await batch.save();

  const notSent = emailResults.filter((r) => r.status !== 'sent');
  const [financeUsers, creator] = await Promise.all([userRepository.findFinanceUsers(), batch.createdBy ? userRepository.findById(batch.createdBy) : null]);
  await notificationService.createForUsers(
    financeUsers.map((u) => u._id),
    {
      type: NOTIFICATION_TYPES.SALARY_BATCH_APPROVED,
      title: 'Salary slips approved for payment',
      message: `${slips.length} salary slip${slips.length === 1 ? '' : 's'} for ${label} (${rupees(totalNet)}) ${slips.length === 1 ? 'is' : 'are'} approved and ready to be paid — see Finance → Salary.`,
    }
  );
  if (creator && String(creator._id) !== String(actor.id)) {
    await notificationService.createForUsers([creator._id], {
      type: NOTIFICATION_TYPES.SALARY_BATCH_APPROVED,
      title: 'Salary slips approved',
      message: `The salary slips for ${label} were approved and mailed.${notSent.length ? ` ${notSent.length} could not be mailed.` : ''}`,
    });
  }
  if (notSent.length) {
    await notificationService.createForUsers([actor.id], {
      type: NOTIFICATION_TYPES.SALARY_BATCH_APPROVED,
      title: `${notSent.length} salary slip${notSent.length === 1 ? '' : 's'} could not be mailed`,
      message: `${label}: ${notSent.map((r) => `${r.employeeName} (${r.status === 'no_address' ? 'no company mail' : 'failed'})`).join(', ')}.`,
    });
  }
  return shape(await SalaryBatch.findById(batch._id), actor);
}

// Back to HR with a note; nothing is mailed and Finance never sees it.
async function sendBack(id, note, actor) {
  const batch = await loadPending(id);
  batch.status = SENT_BACK;
  batch.decidedBy = actor.id;
  batch.decidedAs = accessService.actingRole(actor, GRANTS[ACCESS.PAYOUT_APPROVAL]);
  batch.decidedAt = new Date();
  batch.note = note;
  await batch.save();
  await SalarySlip.updateMany({ _id: { $in: batch.slips }, approvalStatus: SALARY_SLIP_APPROVAL.PENDING }, { approvalStatus: SALARY_SLIP_APPROVAL.REJECTED });

  const [hrUsers, creator] = await Promise.all([userRepository.findHr(), batch.createdBy ? userRepository.findById(batch.createdBy) : null]);
  const recipients = [...new Set([...hrUsers.map((u) => String(u._id)), ...(creator ? [String(creator._id)] : [])])].filter((uid) => uid !== String(actor.id));
  await notificationService.createForUsers(recipients, {
    type: NOTIFICATION_TYPES.SALARY_BATCH_SENT_BACK,
    title: 'Salary slips sent back',
    message: `The salary slips for ${periodLabel(batch)} were sent back: ${note}`,
  });
  return shape(batch, actor);
}

module.exports = { openBatch, listForApprover, approve, sendBack };
