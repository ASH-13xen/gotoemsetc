const cron = require('node-cron');
const weeklyCalendarService = require('../services/weeklyCalendar.service');
const logger = require('../utils/logger');

// Weekly Calendar:
//  * every 5 minutes — an in-app reminder ~10 minutes before each meeting
//    (reminderSentAt keeps it to one per meeting; a reschedule clears it);
//  * 08:30 every morning — a "Your day" email to everyone with something on
//    today, sent from HR to their company mail.
function start() {
  cron.schedule(
    '*/5 * * * *',
    () => {
      weeklyCalendarService.sendDueReminders().catch((err) => logger.error({ err }, 'Weekly calendar reminders failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
  cron.schedule(
    '30 8 * * *',
    () => {
      weeklyCalendarService
        .sendDailyDigests()
        .then((sent) => sent && logger.info({ sent }, 'Weekly calendar digests sent'))
        .catch((err) => logger.error({ err }, 'Weekly calendar digests failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start };
