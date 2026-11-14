const cron = require('node-cron');
const clientWork = require('../services/clientWork.service');
const workLog = require('../services/workLog.service');
const ticketService = require('../services/ticket.service');
const ticketHours = require('../services/ticketHours.service');
const weeklyCalendar = require('../services/weeklyCalendar.service');
const logger = require('../utils/logger');
const { istDateKey } = require('../utils/istDate');

// Client work and the work timer, India time:
//  - every 5 minutes, running timers that passed lunch, the end of the shift
//    or the end of the day stop at that moment;
//  - 23:58, the day's timer-stopped stretches are cut back to the person's
//    last scan if they left earlier;
//  - 00:15, open tickets from a month that has ended are carried over, each
//    client's new month starts as a copy of the last, and months that have
//    started get their tickets (it does nothing on days nothing is due).
function start() {
  // Hourly: scheduled tickets whose posting date has come go to the SMM to upload.
  cron.schedule('5 * * * *', () => ticketService.releaseScheduled().catch((err) => logger.error({ err }, 'Releasing scheduled tickets failed')), { timezone: 'Asia/Kolkata' });
  // Every half hour: meetings that ended log their length for the people in them.
  cron.schedule('*/30 * * * *', () => weeklyCalendar.logMeetingHours().catch((err) => logger.error({ err }, 'Logging meeting hours failed')), { timezone: 'Asia/Kolkata' });
  // 01:00: hours nobody confirmed in three days stand as estimated.
  cron.schedule('0 1 * * *', () => ticketHours.autoConfirm().catch((err) => logger.error({ err }, 'Auto-confirming hours failed')), { timezone: 'Asia/Kolkata' });
  cron.schedule('*/5 * * * *', () => workLog.autoStop().catch((err) => logger.error({ err }, 'Work timer auto-stop failed')), { timezone: 'Asia/Kolkata' });
  cron.schedule('58 23 * * *', () => workLog.trimToScans(istDateKey(new Date())).catch((err) => logger.error({ err }, 'Work timer trim failed')), {
    timezone: 'Asia/Kolkata',
  });
  cron.schedule(
    '15 0 * * *',
    async () => {
      try {
        const carried = await clientWork.carryOver();
        const rolled = await clientWork.rollMonth();
        if (carried || rolled.started || rolled.generated) logger.info({ carried, ...rolled }, 'Client work month roll');
      } catch (err) {
        logger.error({ err }, 'Client work month roll failed');
      }
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start };
