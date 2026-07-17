const cron = require('node-cron');
const attendanceClassifierService = require('../services/attendanceClassifier.service');
const logger = require('../utils/logger');

// 8pm IST, daily — 1.5 hours past the 6:30pm shift end, so every realistic
// scan for the day has already landed. Pinned to Asia/Kolkata explicitly,
// same reasoning as interviewReminder.job.js (Render runs in UTC).
function start() {
  cron.schedule(
    '0 20 * * *',
    () => {
      attendanceClassifierService
        .classifyDay()
        .catch((err) => logger.error({ err }, 'Attendance classifier job failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start };
