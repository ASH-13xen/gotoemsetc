const taskNotify = require('./taskNotify.service');
const teamRepository = require('../repositories/team.repository');
const notificationService = require('./notification.service');
const { NOTIFICATION_TYPES } = require('../config/constants');

// Reuses taskNotify's employee-ref -> User-id resolver (toId-safe against
// populated vs raw refs) — nothing about it is task-specific.
async function notifyResponsibilityAssignment(responsibility, event) {
  let employeeIds = [...(responsibility.assignedEmployees || [])];
  if (responsibility.assignedTeam) {
    const team = await teamRepository.findById(responsibility.assignedTeam);
    if (team) employeeIds = employeeIds.concat(team.members || []);
  }
  if (employeeIds.length === 0) return;

  const userIds = await taskNotify.resolveUserIdsForEmployees(employeeIds);
  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.EVENT_RESPONSIBILITY_ASSIGNED,
    title: `New event responsibility — ${event.title}`,
    message: `"${responsibility.title}" has been assigned to you for ${event.title}.`,
  });
}

module.exports = { notifyResponsibilityAssignment };
