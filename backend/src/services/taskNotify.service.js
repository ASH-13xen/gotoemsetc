const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const { NOTIFICATION_TYPES } = require('../config/constants');

function toId(value) {
  if (!value) return null;
  return (value._id || value).toString();
}

async function resolveUserIdsForEmployees(employeeRefs) {
  const unique = [...new Set(employeeRefs.map(toId).filter(Boolean))];
  if (unique.length === 0) return [];
  const users = await Promise.all(unique.map((id) => userRepository.findByEmployeeId(id)));
  return users.filter(Boolean).map((u) => u._id);
}

async function resolveAdminUserIds() {
  const admins = await userRepository.findAdmins();
  return admins.map((a) => a._id);
}

// Whoever's responsible for this client (assigned employees + main
// employee) plus every admin — the standard recipient set for
// cycle-level notifications (reminders, missed-task sweeps).
async function notifyClientTeam(client, payload) {
  const employeeIds = [...(client.assignedEmployees || []), client.mainEmployee].filter(Boolean);
  const [teamUserIds, adminUserIds] = await Promise.all([
    resolveUserIdsForEmployees(employeeIds),
    resolveAdminUserIds(),
  ]);
  const recipients = [...new Set([...teamUserIds, ...adminUserIds].map(String))];
  await notificationService.createForUsers(recipients, payload);
}

async function notifyTaskAssignment(task, client) {
  const employeeIds = [...(task.assignedEmployees || []), task.leadEmployee].filter(Boolean);
  const userIds = await resolveUserIdsForEmployees(employeeIds);
  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.TASK_ASSIGNED,
    title: `New task assigned — ${client.clientName}`,
    message: `${task.itemLabel} (${task.sectionName}) has been assigned to you.`,
    client: client._id,
    task: task._id,
  });
}

async function notifyStepAssignment(task, client, step) {
  const userIds = await resolveUserIdsForEmployees(step.assignedEmployees || []);
  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.TASK_ASSIGNED,
    title: `New step assigned — ${client.clientName}`,
    message: `"${step.label}" on ${task.itemLabel} (${task.sectionName}) has been assigned to you.`,
    client: client._id,
    task: task._id,
  });
}

async function notifyStepOverdue(task, client, step) {
  const userIds = await resolveUserIdsForEmployees(step.assignedEmployees || []);
  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.STEP_OVERDUE,
    title: `Step overdue — ${client.clientName}`,
    message: `"${step.label}" on ${task.itemLabel} (${task.sectionName}) was due ${step.dueDate.toLocaleDateString()}.`,
    client: client._id,
    task: task._id,
  });
}

module.exports = {
  resolveUserIdsForEmployees,
  resolveAdminUserIds,
  notifyClientTeam,
  notifyTaskAssignment,
  notifyStepAssignment,
  notifyStepOverdue,
};
