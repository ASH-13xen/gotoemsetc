const cron = require('node-cron');
const weeklyCalendarService = require('../services/weeklyCalendar.service');
const logger = require('../utils/logger');

// Weekly Calendar:
//  * every 5 minutes — an in-app reminder ~10 minutes before each meeting
//    (or before a guest's own slice of it; reminderSentAt / remindedAt keep
//    it to one each, and a reschedule clears them);
//  * 08:30 every morning — a "Your day" email to everyone with something on
//    today, sent from HR to their company mail;
//  * 01:15 every night, and once shortly after the server starts — repeating
//    events get their next dates, so they always run a year ahead.
function extendRepeats() {
  weeklyCalendarService
    .extendRepeats()
    .then((added) => added && logger.info({ added }, 'Repeating calendar events extended'))
    .catch((err) => logger.error({ err }, 'Extending repeating calendar events failed'));
}

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
  cron.schedule('15 1 * * *', extendRepeats, { timezone: 'Asia/Kolkata' });
  setTimeout(extendRepeats, 60_000).unref();
}

module.exports = { start };
