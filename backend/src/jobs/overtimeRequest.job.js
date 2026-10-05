const cron = require('node-cron');
const overtimeRequestService = require('../services/overtimeRequest.service');
const logger = require('../utils/logger');

// Overtime is sent for review once its day is closed: shortly after
// midnight (the attendance backstop settles the day at 23:55), and once at
// start-up in case the server was down overnight.
function run() {
  overtimeRequestService
    .raiseFromBiometric({ force: true })
    .then((raised) => raised && logger.info({ raised }, 'Overtime sent for review'))
    .catch((err) => logger.error({ err }, 'Overtime review job failed'));
}

function start() {
  cron.schedule('10 0 * * *', run, { timezone: 'Asia/Kolkata' });
  setTimeout(run, 30 * 1000);
}

module.exports = { start };
