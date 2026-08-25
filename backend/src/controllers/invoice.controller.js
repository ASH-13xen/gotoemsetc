const asyncHandler = require('../utils/asyncHandler');
const invoiceService = require('../services/invoice.service');

const listPlanPrices = asyncHandler(async (req, res) => {
  const prices = await invoiceService.listPlanPrices();
  res.json({ prices });
});

const setPlanPrices = asyncHandler(async (req, res) => {
  const prices = await invoiceService.setPlanPrices(req.body.prices);
  req.auditContext = { action: 'invoice.setPlanPrices', resourceType: 'PlanPrice' };
  res.json({ prices });
});

const list = asyncHandler(async (req, res) => {
  const invoices = await invoiceService.listAll(req.query);
  res.json({ invoices });
});

const summary = asyncHandler(async (req, res) => {
  const result = await invoiceService.summary(req.query);
  res.json(result);
});

const downloadPdf = asyncHandler(async (req, res) => {
  const { pdf, invoiceNumber } = await invoiceService.getInvoicePdf(req.params.id);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="${invoiceNumber.replace(/\//g, '-')}.pdf"`);
  res.send(pdf);
});

// Manual trigger, on top of the monthly cron (jobs/invoiceGeneration.job.js)
// — useful for the first run before the 1st of a month, or re-running after
// adding a client. Defaults to the month that just ended.
const generate = asyncHandler(async (req, res) => {
  const now = new Date();
  const defaultMonth = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
  const defaultYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const year = req.body.year || defaultYear;
  const month = req.body.month || defaultMonth;
  const invoices = await invoiceService.generateForMonth(year, month);
  req.auditContext = { action: 'invoice.generate', resourceType: 'Invoice', metadata: { year, month, count: invoices.length } };
  res.status(201).json({ invoices });
});

const approve = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.approveInvoice(req.params.id, req.user);
  req.auditContext = { action: 'invoice.approve', resourceType: 'Invoice', resourceId: invoice._id };
  res.json({ invoice });
});

const markPaid = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.markInvoicePaid(req.params.id, req.body, req.user);
  req.auditContext = { action: 'invoice.markPaid', resourceType: 'Invoice', resourceId: invoice._id };
  res.json({ invoice });
});

module.exports = { listPlanPrices, setPlanPrices, list, summary, downloadPdf, generate, approve, markPaid };
