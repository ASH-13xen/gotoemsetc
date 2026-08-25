const fs = require('node:fs/promises');
const path = require('node:path');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const invoiceRepository = require('../repositories/invoice.repository');
const planPriceRepository = require('../repositories/planPrice.repository');
const taskClientRepository = require('../repositories/taskClient.repository');
const emailService = require('./email.service');
const notificationService = require('./notification.service');
const userRepository = require('../repositories/user.repository');
const { fillTemplate, renderPdfFromHtml } = require('./htmlRender.service');
const { numberToIndianWords } = require('./mergeData.service');
const { NOTIFICATION_TYPES, INVOICE_STATUS } = require('../config/constants');

const TEMPLATE_FILE = 'invoice.html';
const PLAN_LABEL = { gold: 'Gold', platinum: 'Platinum', diamond: 'Diamond' };
const MONTH_LABEL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function financeFrom() {
  const match = /<([^>]+)>/.exec(env.resend.fromEmail || '');
  const address = match ? match[1] : env.resend.fromEmail;
  return `Finance <${address}>`;
}

// Indian financial year runs April-March — "2026-27" for any date from
// April 2026 through March 2027.
function fyPrefix(date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-12
  return month >= 4 ? `${year}-${String((year + 1) % 100).padStart(2, '0')}` : `${year - 1}-${String(year % 100).padStart(2, '0')}`;
}

async function nextInvoiceNumber(date) {
  const prefix = fyPrefix(date);
  const count = await invoiceRepository.countForFyPrefix(prefix);
  return `INV/${prefix}/${String(count + 1).padStart(4, '0')}`;
}

function resolvePrimaryContact(client) {
  const contacts = client.contacts || [];
  return contacts.find((c) => c.isPrimary) || contacts[0] || null;
}

async function listPlanPrices() {
  return planPriceRepository.listAllEnsured();
}

async function setPlanPrices(prices) {
  for (const { plan, amount } of prices) {
    // eslint-disable-next-line no-await-in-loop
    await planPriceRepository.setAmount(plan, amount);
  }
  return planPriceRepository.listAllEnsured();
}

// Cron worklist — see jobs/invoiceGeneration.job.js. Billed in arrears: run
// on the 1st for the month that just ended. Idempotent — skips any client
// that already has an invoice for {year, month}. Sequential (not
// Promise.all) so nextInvoiceNumber's count-then-create never races itself.
async function generateForMonth(year, month) {
  const clients = await taskClientRepository.list();
  const created = [];

  for (const client of clients) {
    if (!client.currentPlan) continue;
    // eslint-disable-next-line no-await-in-loop
    const existing = await invoiceRepository.findByClientAndMonth(client._id, year, month);
    if (existing) continue;

    // eslint-disable-next-line no-await-in-loop
    const planPrice = await planPriceRepository.findByPlan(client.currentPlan);
    const amount = planPrice?.amount || 0;
    // eslint-disable-next-line no-await-in-loop
    const invoiceNumber = await nextInvoiceNumber(new Date());

    // eslint-disable-next-line no-await-in-loop
    const invoice = await invoiceRepository.create({
      client: client._id,
      year,
      month,
      plan: client.currentPlan,
      amount,
      invoiceNumber,
    });
    created.push(invoice);
  }

  if (created.length > 0) {
    const approvers = await userRepository.findInvoiceApprovers();
    if (approvers.length > 0) {
      await notificationService.createForUsers(approvers.map((u) => u._id), {
        type: NOTIFICATION_TYPES.INVOICE_PENDING_APPROVAL,
        title: 'Invoices pending approval',
        message: `${created.length} invoice${created.length === 1 ? '' : 's'} generated for ${MONTH_LABEL[month - 1]} ${year} and awaiting your approval.`,
      });
    }
  }

  return created;
}

function buildMergeData(invoice) {
  const client = invoice.client;
  const contact = resolvePrimaryContact(client);
  return {
    companyName: env.companyName,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    billingPeriodLabel: `${MONTH_LABEL[invoice.month - 1]} ${invoice.year}`,
    clientName: client.brandName || client.name,
    contactName: contact?.name || '',
    contactEmail: contact?.email || '',
    planLabel: PLAN_LABEL[invoice.plan] || invoice.plan,
    amount: `₹${Number(invoice.amount).toLocaleString('en-IN')}`,
    amountInWords: `Rupees ${numberToIndianWords(invoice.amount)} Only`,
  };
}

// Never stored — regenerated fresh from the invoice's own snapshot fields
// every time, same "live document" choice as clientManual.service.js.
async function buildInvoicePdf(invoice) {
  const mergeData = buildMergeData(invoice);
  const templateHtml = await fs.readFile(path.join(env.templatesHtmlDir, TEMPLATE_FILE), 'utf8');
  const filledHtml = fillTemplate(templateHtml, mergeData);
  return renderPdfFromHtml(filledHtml, env.templatesHtmlDir);
}

async function getInvoicePdf(id) {
  const invoice = await invoiceRepository.findById(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  const pdf = await buildInvoicePdf(invoice);
  return { pdf, invoiceNumber: invoice.invoiceNumber };
}

async function listAll(filters) {
  return invoiceRepository.list(filters);
}

// admin/ceo only (see requireRole(ADMIN, CEO) at the route) — collapses
// "approve" and "send to client" into one action, matching the spec exactly
// ("once approved they will be sent to the client's mail").
async function approveInvoice(id, actingUser) {
  const invoice = await invoiceRepository.findById(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.status !== INVOICE_STATUS.PENDING_APPROVAL) {
    throw ApiError.conflict('This invoice has already been approved');
  }

  const pdf = await buildInvoicePdf(invoice);
  const contact = resolvePrimaryContact(invoice.client);
  const now = new Date();
  const updated = await invoiceRepository.updateById(id, {
    status: INVOICE_STATUS.SENT,
    approvedBy: actingUser.id,
    approvedAt: now,
    sentAt: now,
  });

  if (contact?.email) {
    await emailService
      .sendEmail({
        to: contact.email,
        subject: `Invoice ${invoice.invoiceNumber} — ${MONTH_LABEL[invoice.month - 1]} ${invoice.year}`,
        html: `<p>Hi ${contact.name || ''},</p><p>Please find attached your invoice for ${MONTH_LABEL[invoice.month - 1]} ${invoice.year}.</p><p>Amount due: ₹${Number(invoice.amount).toLocaleString('en-IN')}</p><p>Thanks,<br/>${env.companyName}</p>`,
        from: financeFrom(),
        attachments: [{ filename: `${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`, content: pdf }],
      })
      .catch(() => {});
  }

  return updated;
}

async function markInvoicePaid(id, transactionDetails, actingUser) {
  const invoice = await invoiceRepository.findById(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.status !== INVOICE_STATUS.SENT) {
    throw ApiError.conflict('Only a sent invoice can be marked paid');
  }
  return invoiceRepository.updateById(id, {
    status: INVOICE_STATUS.PAID,
    paidAt: new Date(),
    paidBy: actingUser.id,
    transactionDetails,
  });
}

// Reporting — total received/due, filterable/groupable by month, client, and
// plan (see routes/invoice.routes.js's GET /summary).
async function summary(filters) {
  const invoices = await invoiceRepository.listForSummary(filters);
  let totalReceived = 0;
  let totalDue = 0;
  const byMonth = new Map();
  const byClient = new Map();

  for (const inv of invoices) {
    if (inv.status === INVOICE_STATUS.PAID) totalReceived += inv.amount;
    else totalDue += inv.amount;

    const monthKey = `${inv.year}-${String(inv.month).padStart(2, '0')}`;
    const monthBucket = byMonth.get(monthKey) || { year: inv.year, month: inv.month, received: 0, due: 0 };
    if (inv.status === INVOICE_STATUS.PAID) monthBucket.received += inv.amount;
    else monthBucket.due += inv.amount;
    byMonth.set(monthKey, monthBucket);

    const clientKey = inv.client?._id?.toString() || 'unknown';
    const clientBucket = byClient.get(clientKey) || { clientId: clientKey, clientName: inv.client?.name || '—', received: 0, due: 0 };
    if (inv.status === INVOICE_STATUS.PAID) clientBucket.received += inv.amount;
    else clientBucket.due += inv.amount;
    byClient.set(clientKey, clientBucket);
  }

  return {
    totalReceived,
    totalDue,
    byMonth: [...byMonth.values()].sort((a, b) => (a.year - b.year) || (a.month - b.month)),
    byClient: [...byClient.values()].sort((a, b) => a.clientName.localeCompare(b.clientName)),
  };
}

module.exports = {
  listPlanPrices,
  setPlanPrices,
  generateForMonth,
  getInvoicePdf,
  listAll,
  approveInvoice,
  markInvoicePaid,
  summary,
};
