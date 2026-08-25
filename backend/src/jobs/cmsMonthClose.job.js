const cron = require('node-cron');
const cmsReportService = require('../services/cmsReport.service');
const istDate = require('../utils/istDate');
const logger = require('../utils/logger');

// Freezes last month's fulfilment report for every client whose calendar is
// still open. Reports are snapshots by design — an edit made in September
// must not be able to rewrite what August turned out to be — and this is what
// takes the snapshot for anyone who didn't close their month by hand.
//
// Idempotent: closeMonth() returns an already-closed calendar untouched, so
// a re-run (or a manual close beforehand) is harmless.
async function closeLastMonth(now = new Date()) {
  const { year, month } = istDate.istParts(now);
  const target = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

  const closed = await cmsReportService.closeMonthForAll(target.year, target.month);
  if (closed.length > 0) {
    logger.info({ ...target, count: closed.length }, 'Closed CMS month-end reports');
  }
  return closed;
}

// 01:00 IST on the 1st of each month — after midnight so the month being
// closed is genuinely over in IST, pinned to Asia/Kolkata rather than the
// server's local time (Render runs in UTC).
function start() {
  cron.schedule(
    '0 1 1 * *',
    () => {
      closeLastMonth().catch((err) => logger.error({ err }, 'CMS month-close job failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start, closeLastMonth };
