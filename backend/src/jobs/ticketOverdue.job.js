const cron = require('node-cron');
const ticketService = require('../services/ticket.service');
const logger = require('../utils/logger');

// Every 15 minutes, stamps each open ticket whose due date has passed — once —
// in its permanent record, and tells whoever it is waiting on and whoever
// raised it. Also run once at start-up so nothing waits for the first tick.
function start() {
  const run = () => ticketService.sweepOverdue().catch((err) => logger.error({ err }, 'Ticket overdue sweep failed'));
  run();
  cron.schedule('*/15 * * * *', run, { timezone: 'Asia/Kolkata' });
}

module.exports = { start };
