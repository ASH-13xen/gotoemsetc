const cron = require('node-cron');
const { CLIENT_STATUS } = require('../config/constants');
const Client = require('../models/Client');
const taskCycleService = require('../services/taskCycle.service');
const taskService = require('../services/task.service');
const logger = require('../utils/logger');

// Runs the full daily task-management pipeline for every onboarded client:
// catch up their cycle + generate this cycle's tasks if not already done,
// then (once, for the whole system) sweep cycles that just ended and send
// "ending soon" reminders. Exported standalone so it can be invoked
// directly for manual verification, same convention as the other jobs.
async function runDailyTaskCycleSync() {
  const clients = await Client.find({ isDeleted: false, status: CLIENT_STATUS.ONBOARDED, onboardedAt: { $ne: null } });

  let cyclesTouched = 0;
  for (const client of clients) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { tasks } = await taskCycleService.syncClientCycle(client._id);
      if (tasks.length > 0) cyclesTouched += 1;
    } catch (err) {
      logger.error({ err, client: client._id }, 'Failed to sync task cycle for client');
    }
  }

  const [{ cyclesClosed, tasksMissed }, { remindersSent }, { stepsNotified }] = await Promise.all([
    taskCycleService.sweepEndedCycles(),
    taskCycleService.sendCycleReminders(),
    taskService.sweepOverdueSteps(),
  ]);

  logger.info(
    { clients: clients.length, cyclesTouched, cyclesClosed, tasksMissed, remindersSent, stepsNotified },
    'Task cycle sync complete'
  );
}

// 3am IST, daily — well before working hours, doesn't compete with the
// 2pm interview/birthday reminder jobs.
function start() {
  cron.schedule(
    '0 3 * * *',
    () => {
      runDailyTaskCycleSync().catch((err) => logger.error({ err }, 'Task cycle job failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start, runDailyTaskCycleSync };
