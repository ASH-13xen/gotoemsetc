const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const fnfSettlementRepository = require('../repositories/fnfSettlement.repository');
const generatedDocumentRepository = require('../repositories/generatedDocument.repository');
const userRepository = require('../repositories/user.repository');
const emailService = require('./email.service');
const notificationService = require('./notification.service');
const { NOTIFICATION_TYPES } = require('../config/constants');

// Called from docGeneration.service.js right after an 'fnf-settlement'
// document is generated — creates the Finance-tracking stub, due by default.
// rawSeveranceAmount is the manual override as submitted (pre currency
// formatting), not the display string baked into mergeDataSnapshot.
async function createFromGeneratedDocument(generatedDocument, employeeId, rawSeveranceAmount) {
  const amount = Number(rawSeveranceAmount);
  return fnfSettlementRepository.create({
    employee: employeeId,
    generatedDocument: generatedDocument._id,
    amount: Number.isFinite(amount) ? amount : undefined,
  });
}

async function listAll() {
  return fnfSettlementRepository.listAll();
}

// Same pattern as salarySlip.service.js#financeFrom / meeting.service.js#meetingsFrom.
function financeFrom() {
  const match = /<([^>]+)>/.exec(env.resend.fromEmail || '');
  const address = match ? match[1] : env.resend.fromEmail;
  return `Finance <${address}>`;
}

function fnfPaidEmailHtml(settlement, transactionDetails) {
  const employeeName = `${settlement.employee.firstName} ${settlement.employee.lastName || ''}`.trim();
  return `<p>Hi ${employeeName},</p>
<p>Your Full &amp; Final settlement has been paid. The signed settlement document is attached.</p>
<p><strong>Amount:</strong> ₹${(Number(settlement.amount) || 0).toLocaleString('en-IN')}<br/>
<strong>Payment mode:</strong> ${transactionDetails.mode || '—'}<br/>
<strong>Reference number:</strong> ${transactionDetails.referenceNumber || '—'}<br/>
<strong>Paid on:</strong> ${transactionDetails.paidOn ? new Date(transactionDetails.paidOn).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}</p>
${transactionDetails.note ? `<p>${transactionDetails.note}</p>` : ''}
<p>Thanks,<br/>Finance</p>`;
}

// requireFinanceAccess-gated. Marks paid, emails the employee's personal
// address with the settlement PDF attached (see the extended
// email.service.js#sendEmail), and in-app-notifies their User account.
async function markPaid(id, transactionDetails, actingUser) {
  const existing = await fnfSettlementRepository.findById(id);
  if (!existing) throw ApiError.notFound('FnF settlement not found');
  if (existing.status === 'paid') throw ApiError.conflict('This FnF settlement is already marked paid');

  const settlement = await fnfSettlementRepository.markPaid(id, { paidBy: actingUser.id, transactionDetails });

  const document = await generatedDocumentRepository.findByIdWithFile(settlement.generatedDocument);
  const attachments =
    document?.pdf?.data ? [{ filename: document.pdf.filename || 'fnf-settlement.pdf', content: document.pdf.data }] : undefined;

  if (settlement.employee?.personalEmail) {
    await emailService
      .sendEmail({
        to: settlement.employee.personalEmail,
        subject: 'Your Full & Final settlement has been paid',
        html: fnfPaidEmailHtml(settlement, transactionDetails),
        from: financeFrom(),
        attachments,
      })
      .catch(() => {});
  }

  const employeeUser = await userRepository.findByEmployeeId(settlement.employee._id);
  if (employeeUser) {
    await notificationService.createForUsers([employeeUser._id], {
      type: NOTIFICATION_TYPES.FNF_SETTLEMENT_PAID,
      title: 'FnF settlement paid',
      message: 'Your Full & Final settlement has been paid.',
      employee: settlement.employee._id,
      fnfSettlement: settlement._id,
    });
  }

  return settlement;
}

module.exports = { createFromGeneratedDocument, listAll, markPaid };
