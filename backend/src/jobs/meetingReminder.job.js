const cron = require('node-cron');
const { NOTIFICATION_TYPES } = require('../config/constants');
const meetingRepository = require('../repositories/meeting.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('../services/notification.service');
const notifyRecipients = require('../services/notifyRecipients.service');
const logger = require('../utils/logger');

// Every 15 minutes — same cadence as employeeTaskFollowUpReminder.job.js.
// Finds meetings whose scheduled time passed more than 24h ago with no MOM
// yet, flags them, and notifies that client's Team Main/global Team Leader/
// CEO. lateFlaggedAt is the dedup guard — stamped once, so a meeting never
// gets re-notified on every subsequent run. Exported (rather than only wired
// into node-cron) for direct/manual verification, same convention as every
// other job in this directory.
async function flagLateMoms() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const meetings = await meetingRepository.findDueForLateMomFlag(cutoff);
  if (!meetings.length) return;

  let flagged = 0;
  for (const meeting of meetings) {
    try {
      const team = meeting.client?.defaultTeam;
      const teamEmployeeIds = team ? [team.leader, ...(team.members || [])].filter(Boolean) : [];
      const [teamUserIds, oversightUsers] = await Promise.all([
        teamEmployeeIds.length ? notifyRecipients.resolveUserIdsForEmployees(teamEmployeeIds) : [],
        userRepository.findCmsOversightUsers(),
      ]);
      const recipientIds = [...new Set([...teamUserIds, ...oversightUsers.map((u) => u._id.toString())])];

      if (recipientIds.length > 0) {
        await notificationService.createForUsers(recipientIds, {
          type: NOTIFICATION_TYPES.MEETING_MOM_LATE,
          title: 'MOM overdue',
          message: `The MOM for the ${meeting.client?.name || 'client'} meeting on ${new Date(
            meeting.scheduledAt
          ).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} is still missing.`,
          meeting: meeting._id,
        });
      }

      await meetingRepository.updateById(meeting._id, { lateFlaggedAt: new Date() });
      flagged += 1;
    } catch (err) {
      logger.error({ err, meetingId: meeting._id }, 'Failed to flag late MOM for meeting');
    }
  }

  if (flagged) logger.info({ count: flagged }, 'Flagged late MOMs');
}

function start() {
  cron.schedule(
    '*/15 * * * *',
    () => {
      flagLateMoms().catch((err) => logger.error({ err }, 'Meeting reminder job failed'));
    },
    { timezone: 'Asia/Kolkata' }
  );
}

module.exports = { start, flagLateMoms };
