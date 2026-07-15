const http = require('node:http');
const app = require('./app');
const env = require('./config/env');
const connectDb = require('./config/db');
const logger = require('./utils/logger');
const interviewReminderJob = require('./jobs/interviewReminder.job');
const birthdayReminderJob = require('./jobs/birthdayReminder.job');
const taskCycleJob = require('./jobs/taskCycle.job');
const clientChat = require('./websocket/clientChat');

async function main() {
  await connectDb();
  interviewReminderJob.start();
  birthdayReminderJob.start();
  taskCycleJob.start();

  // Socket.io needs the raw HTTP server (not just the Express app) to
  // upgrade connections on the same port.
  const httpServer = http.createServer(app);
  clientChat.init(httpServer);

  httpServer.listen(env.port, () => {
    logger.info(`EMS backend listening on port ${env.port}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
