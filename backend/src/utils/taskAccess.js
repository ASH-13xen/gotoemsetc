const { isAdminLike } = require('./roles');
const { EMPLOYEE_TASK_TYPE, EMPLOYEE_TASK_STATUS, PERMISSIONS } = require('../config/constants');

// Two independently-grantable permissions, deliberately not one blanket
// permission — MANAGE_TASKS covers top-level team/client/event tasks and
// the team/client/event registries; MANAGE_SUBTASKS covers subtask
// creation/review/completion. Holding one never implies the other; admin/HR
// implicitly hold both, same as every other permission in this app.
function hasFullTaskAccess(user) {
  return isAdminLike(user) || Boolean(user.permissions?.includes(PERMISSIONS.MANAGE_TASKS));
}

function hasSubtaskManageAccess(user) {
  return isAdminLike(user) || Boolean(user.permissions?.includes(PERMISSIONS.MANAGE_SUBTASKS));
}

// Populated refs arrive as full documents (per employeeTask.repository.js),
// not raw ObjectIds — a populated Mongoose Document's own .toString() is
// not its _id, so every comparison here has to unwrap ._id first or it
// silently never matches. Mirrors clientAccess.js's toId() exactly.
function toId(value) {
  if (!value) return null;
  return (value._id || value).toString();
}

function idsInclude(list, id) {
  if (!id) return false;
  return (list || []).some((item) => toId(item) === id);
}

// Personal: the one assignee. Team/client/event top-level task: the live
// team roster — members, the leader themself (whether or not they're also
// listed in members), and any ad-hoc extra members. Subtasks (any type):
// whoever they were explicitly delegated to.
function isAssignee(user, task) {
  if (!user.employeeLink) return false;
  const employeeId = user.employeeLink.toString();

  if (task.parentTask || task.type === EMPLOYEE_TASK_TYPE.PERSONAL) {
    return idsInclude(task.assignedEmployees, employeeId);
  }
  return (
    idsInclude(task.team?.members, employeeId) ||
    idsInclude(task.extraMembers, employeeId) ||
    toId(task.team?.leader) === employeeId
  );
}

// Requires task.team populated with at least `leader`.
function isTeamLeader(user, task) {
  if (!user.employeeLink || !task.team) return false;
  return toId(task.team.leader) === user.employeeLink.toString();
}

// Requires task.assignedEmployees[0] populated with `manager`. Only
// meaningful for personal tasks (team/client/event tasks route completion
// through isTeamLeader instead).
function isPersonalManager(user, task) {
  if (!user.employeeLink) return false;
  const assignee = task.assignedEmployees?.[0];
  if (!assignee || typeof assignee !== 'object') return false;
  return toId(assignee.manager) === user.employeeLink.toString();
}

function canViewTask(user, task) {
  if (hasFullTaskAccess(user) || hasSubtaskManageAccess(user)) return true;
  if (isAssignee(user, task)) return true;
  if (isTeamLeader(user, task)) return true;
  if (task.type === EMPLOYEE_TASK_TYPE.PERSONAL && isPersonalManager(user, task)) return true;
  return false;
}

// Subtasks are one level deep — parentTask must itself be a top-level task
// (enforced by the caller passing the real parent, never a subtask).
function canCreateSubtask(user, parentTask) {
  if (hasSubtaskManageAccess(user)) return true;
  return parentTask.type !== EMPLOYEE_TASK_TYPE.PERSONAL && isTeamLeader(user, parentTask);
}

// The doer's audience for moving a task off "pending" — personal tasks and
// subtasks (any type): the assignee(s). Top-level team/client/event tasks:
// the leader only — a team/extra member can't move the main task, only
// their own subtasks.
function isReviewInitiator(user, task) {
  if (task.type === EMPLOYEE_TASK_TYPE.PERSONAL || task.parentTask) return isAssignee(user, task);
  return isTeamLeader(user, task);
}

// The sign-off audience for a task once it's up for review — personal:
// admin/HR or the assignee's manager. Subtasks (any type): admin/HR or the
// team leader. Top-level team/client/event tasks: admin/HR ONLY — the
// leader already made the review call themselves, so sign-off isn't
// self-servable by that same leader.
function hasCompletionAuthority(user, task) {
  if (task.type === EMPLOYEE_TASK_TYPE.PERSONAL) {
    return isAdminLike(user) || isPersonalManager(user, task);
  }
  if (task.parentTask) {
    return hasSubtaskManageAccess(user) || isTeamLeader(user, task);
  }
  return hasFullTaskAccess(user);
}

// Only meaningful when the task actually requires review — see
// canMarkCompletedDirect for the review-optional counterpart.
function canMarkForReview(user, task) {
  if (task.status !== EMPLOYEE_TASK_STATUS.PENDING || !task.reviewMandatory) return false;
  return isReviewInitiator(user, task);
}

// Review-optional tasks skip the for_review checkpoint entirely — the same
// person who'd otherwise mark it for review instead completes it directly.
function canMarkCompletedDirect(user, task) {
  if (task.status !== EMPLOYEE_TASK_STATUS.PENDING || task.reviewMandatory) return false;
  return isReviewInitiator(user, task);
}

function canMarkCompleted(user, task) {
  if (task.status !== EMPLOYEE_TASK_STATUS.FOR_REVIEW) return false;
  return hasCompletionAuthority(user, task);
}

// Sending a for_review task back to pending (with optional edits) is the
// same call as approving it — whoever could complete it can instead reject
// it. See employeeTask.service.js#rejectTask.
function canRejectTask(user, task) {
  if (task.status !== EMPLOYEE_TASK_STATUS.FOR_REVIEW) return false;
  return hasCompletionAuthority(user, task);
}

function canToggleFollowUp(user, task) {
  if (hasFullTaskAccess(user) || hasSubtaskManageAccess(user)) return true;
  if (isAssignee(user, task)) return true;
  return task.type !== EMPLOYEE_TASK_TYPE.PERSONAL && isTeamLeader(user, task);
}

module.exports = {
  toId,
  isAssignee,
  isTeamLeader,
  isPersonalManager,
  isReviewInitiator,
  hasCompletionAuthority,
  hasFullTaskAccess,
  hasSubtaskManageAccess,
  canViewTask,
  canCreateSubtask,
  canMarkForReview,
  canMarkCompletedDirect,
  canMarkCompleted,
  canRejectTask,
  canToggleFollowUp,
};
