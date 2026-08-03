const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const { NOTIFICATION_TYPES, EMPLOYEE_TASK_TYPE } = require('../config/constants');

// Deliberately separate from taskNotify.service.js's identical-looking
// helper — that one belongs to the unrelated CMS Task/TaskCycle system.
function toId(value) {
  if (!value) return null;
  return (value._id || value).toString();
}

async function resolveUserIdsForEmployees(employeeRefs) {
  const unique = [...new Set((employeeRefs || []).map(toId).filter(Boolean))];
  if (unique.length === 0) return [];
  const users = await Promise.all(unique.map((id) => userRepository.findByEmployeeId(id)));
  return users.filter(Boolean).map((u) => u._id);
}

// Everyone this task is currently "on the plate" of — mirrors
// taskAccess.js#isAssignee's roster logic (team members + leader + extra
// members for team/client/event; the sole assignee for personal/subtasks).
function taskAssigneeEmployeeIds(task) {
  if (task.parentTask || task.type === EMPLOYEE_TASK_TYPE.PERSONAL) {
    return task.assignedEmployees || [];
  }
  return [...(task.team?.members || []), task.team?.leader, ...(task.extraMembers || [])].filter(Boolean);
}

async function notifyAssigned(task) {
  const userIds = await resolveUserIdsForEmployees(taskAssigneeEmployeeIds(task));
  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.EMPLOYEE_TASK_ASSIGNED,
    title: task.parentTask ? `New subtask assigned — ${task.title}` : `New task assigned — ${task.title}`,
    message: `"${task.title}" is due ${new Date(task.endAt).toLocaleString('en-IN')}.`,
    employeeTask: task._id,
  });
}

// Whoever needs to sign off — the assignee's manager for a personal task,
// the team's leader otherwise, plus every admin/HR so nothing silently
// stalls if the designated reviewer misses it.
async function notifyForReview(task) {
  const reviewerEmployeeIds = [];
  if (task.type === EMPLOYEE_TASK_TYPE.PERSONAL) {
    const manager = task.assignedEmployees?.[0]?.manager;
    if (manager) reviewerEmployeeIds.push(manager);
  } else if (task.team?.leader) {
    reviewerEmployeeIds.push(task.team.leader);
  }

  const [reviewerUserIds, adminUserIds] = await Promise.all([
    resolveUserIdsForEmployees(reviewerEmployeeIds),
    userRepository.findAdmins().then((admins) => admins.map((a) => a._id)),
  ]);
  const recipients = [...new Set([...reviewerUserIds, ...adminUserIds].map(String))];

  await notificationService.createForUsers(recipients, {
    type: NOTIFICATION_TYPES.EMPLOYEE_TASK_FOR_REVIEW,
    title: `Task marked for review — ${task.title}`,
    message: `"${task.title}" was marked for review and needs your sign-off.`,
    employeeTask: task._id,
  });
}

async function notifyCompleted(task) {
  const userIds = await resolveUserIdsForEmployees(taskAssigneeEmployeeIds(task));
  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.EMPLOYEE_TASK_COMPLETED,
    title: `Task completed — ${task.title}`,
    message: `"${task.title}" has been marked completed.`,
    employeeTask: task._id,
  });
}

async function notifyRejected(task, note) {
  const userIds = await resolveUserIdsForEmployees(taskAssigneeEmployeeIds(task));
  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.EMPLOYEE_TASK_REJECTED,
    title: `Marked for review rejected — ${task.title}`,
    message: note
      ? `"${task.title}" needs to be redone: ${note}`
      : `"${task.title}" needs to be redone — new dates have been set.`,
    employeeTask: task._id,
  });
}

async function notifyFollowUpDue(task, followUp) {
  const userIds = await resolveUserIdsForEmployees(taskAssigneeEmployeeIds(task));
  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.EMPLOYEE_TASK_FOLLOWUP_REMINDER,
    title: `Follow-up due — ${task.title}`,
    message: followUp.note
      ? `Follow-up due on "${task.title}": ${followUp.note}`
      : `A follow-up is due now on "${task.title}".`,
    employeeTask: task._id,
  });
}

module.exports = {
  resolveUserIdsForEmployees,
  taskAssigneeEmployeeIds,
  notifyAssigned,
  notifyForReview,
  notifyCompleted,
  notifyRejected,
  notifyFollowUpDue,
};
