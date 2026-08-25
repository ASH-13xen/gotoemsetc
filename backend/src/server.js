const http = require('node:http');
const app = require('./app');
const env = require('./config/env');
const connectDb = require('./config/db');
const logger = require('./utils/logger');
const interviewReminderJob = require('./jobs/interviewReminder.job');
const birthdayReminderJob = require('./jobs/birthdayReminder.job');
const attendanceClassifierJob = require('./jobs/attendanceClassifier.job');
const employeeTaskFollowUpReminderJob = require('./jobs/employeeTaskFollowUpReminder.job');
const cmsMonthCloseJob = require('./jobs/cmsMonthClose.job');
const meetingReminderJob = require('./jobs/meetingReminder.job');
const monthlyBillCycleJob = require('./jobs/monthlyBillCycle.job');
const reimbursementPaymentReminderJob = require('./jobs/reimbursementPaymentReminder.job');
const invoiceGenerationJob = require('./jobs/invoiceGeneration.job');

async function main() {
  await connectDb();
  interviewReminderJob.start();
  birthdayReminderJob.start();
  attendanceClassifierJob.start();
  employeeTaskFollowUpReminderJob.start();
  cmsMonthCloseJob.start();
  meetingReminderJob.start();
  monthlyBillCycleJob.start();
  reimbursementPaymentReminderJob.start();
  invoiceGenerationJob.start();

  // Still built on the raw HTTP server rather than app.listen: the client
  // chat socket that needed it is gone, but the Client Management System's
  // calendar will want the same upgrade path.
  const httpServer = http.createServer(app);

  httpServer.listen(env.port, () => {
    logger.info(`EMS backend listening on port ${env.port}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
