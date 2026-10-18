const cron = require('node-cron');
const ticketService = require('../services/ticket.service');
const ticketRepeatService = require('../services/ticketRepeat.service');
const logger = require('../utils/logger');

// Every 15 minutes, stamps each open ticket whose due date has passed — once —
// in its permanent record, and tells whoever it is waiting on and whoever
// raised it. Each run also raises the day's copy of every repeating ticket
// whose date has come (9:00 am IST). Also run once at start-up so nothing
// waits for the first tick.
function start() {
  const run = () => {
    ticketService.sweepOverdue().catch((err) => logger.error({ err }, 'Ticket overdue sweep failed'));
    ticketRepeatService
      .runDue()
      .then((raised) => raised && logger.info({ raised }, 'Repeating tickets raised'))
      .catch((err) => logger.error({ err }, 'Repeating tickets failed'));
  };
  run();
  cron.schedule('*/15 * * * *', run, { timezone: 'Asia/Kolkata' });
}

module.exports = { start };
