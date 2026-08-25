const notifyRecipients = require('./notifyRecipients.service');
const workTeamRepository = require('../repositories/workTeam.repository');
const notificationService = require('./notification.service');
const { NOTIFICATION_TYPES } = require('../config/constants');

// Reuses the shared employee-ref -> User-id resolver (toId-safe against
// populated vs raw refs).
async function notifyResponsibilityAssignment(responsibility, event) {
  let employeeIds = [...(responsibility.assignedEmployees || [])];
  if (responsibility.assignedTeam) {
    const team = await workTeamRepository.findById(responsibility.assignedTeam);
    // A WorkTeam's leader is never listed in `members`, so notify them
    // explicitly — otherwise the one person accountable for the team's work
    // is the only one who doesn't hear about it.
    if (team) employeeIds = employeeIds.concat(team.members || [], team.leader ? [team.leader] : []);
  }
  if (employeeIds.length === 0) return;

  const userIds = await notifyRecipients.resolveUserIdsForEmployees(employeeIds);
  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.EVENT_RESPONSIBILITY_ASSIGNED,
    title: `New event responsibility — ${event.title}`,
    message: `"${responsibility.title}" has been assigned to you for ${event.title}.`,
  });
}

module.exports = { notifyResponsibilityAssignment };
