const cron = require('node-cron');
const { NOTIFICATION_TYPES } = require('../config/constants');
const interviewRepository = require('../repositories/interview.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('../services/notification.service');
const { formatDateTime } = require('../templates/email/interviewScheduled');
const logger = require('../utils/logger');

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Runs once for every Interview scheduled today that hasn't had a reminder
// sent — notifies the person who scheduled it plus every admin. Exported
// (rather than only wired into node-cron) so it can be invoked directly in
// tests/manual verification.
async function sendDueReminders() {
  const { start, end } = todayRange();
  const dueInterviews = await interviewRepository.findDueForReminder(start, end);
  if (!dueInterviews.length) return;

  const admins = await userRepository.findAdmins();
  const adminIds = admins.map((a) => a._id);

  for (const interview of dueInterviews) {
    const applicant = interview.applicant;
    if (!applicant) continue;
    const applicantName = `${applicant.firstName} ${applicant.lastName || ''}`.trim();
    const recipientIds = [interview.scheduledBy, ...adminIds];

    await notificationService.createForUsers(recipientIds, {
      type: NOTIFICATION_TYPES.INTERVIEW_REMINDER,
      title: 'Interview today',
      message: `Reminder: interview with ${applicantName} (${applicant.positionAppliedFor || 'applicant'}) is today at ${formatDateTime(interview.scheduledAt)}.`,
      applicant: applicant._id,
      interview: interview._id,
    });

    await interviewRepository.updateById(interview._id, { reminderSentAt: new Date() });
  }

  logger.info({ count: dueInterviews.length }, 'Sent interview reminder notifications');
}

// 8am server time, daily.
function start() {
  cron.schedule('0 8 * * *', () => {
    sendDueReminders().catch((err) => logger.error({ err }, 'Interview reminder job failed'));
  });
}

module.exports = { start, sendDueReminders };
