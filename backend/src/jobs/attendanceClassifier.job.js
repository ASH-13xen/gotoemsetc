const cron = require('node-cron');
const attendanceClassifierService = require('../services/attendanceClassifier.service');
const logger = require('../utils/logger');

// 11:55pm IST, daily — real-time processing (see
// devicePunch.service.js#recordPunch -> attendanceClassifier.service.js)
// handles classification the moment each scan arrives, so this is only a
// backstop: it catches employees with zero scans all day (the one thing
// that can never be event-driven — there's no event for nothing happening)
// and settles any stragglers real-time processing didn't get to. Pinned to
// Asia/Kolkata explicitly, same reasoning as interviewReminder.job.js
// (Render runs in UTC).
function start() {
  cron.schedule(
    '55 23 * * *',
    () => {
      attendanceClassifierService
        .runNightlyBackstop()
        .catch((err) => logger.error({ err }, 'Attendance backstop job failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start };
