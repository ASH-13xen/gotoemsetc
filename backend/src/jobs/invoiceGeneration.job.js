const cron = require('node-cron');
const invoiceService = require('../services/invoice.service');
const logger = require('../utils/logger');

// 1st of every month, 00:30 IST (after the 00:00 monthly bill cycle job) —
// bills in arrears, for the month that just ended.
async function generateMonthlyInvoices() {
  const now = new Date();
  const lastMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = lastMonthDate.getUTCFullYear();
  const month = lastMonthDate.getUTCMonth() + 1;

  const created = await invoiceService.generateForMonth(year, month);
  if (created.length) logger.info({ count: created.length, year, month }, 'Generated monthly invoices');
}

function start() {
  cron.schedule(
    '30 0 1 * *',
    () => {
      generateMonthlyInvoices().catch((err) => logger.error({ err }, 'Invoice generation job failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start, generateMonthlyInvoices };
