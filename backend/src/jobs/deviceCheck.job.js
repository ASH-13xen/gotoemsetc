const cron = require('node-cron');
const deviceService = require('../services/device.service');
const logger = require('../utils/logger');

// 10:00am IST daily — on the 1st, everyone holding a company device is
// reminded of the month's check; the day after it is due, whoever hasn't
// sent it is reminded again (device.service.js#sendMonthlyReminders). Other
// days it does nothing.
function start() {
  cron.schedule(
    '0 10 * * *',
    () => {
      deviceService
        .sendMonthlyReminders()
        .then((n) => n && logger.info({ reminded: n }, 'Device check reminders sent'))
        .catch((err) => logger.error({ err }, 'Device check reminder job failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start };
