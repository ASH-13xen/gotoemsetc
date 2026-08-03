const ApiError = require('../utils/ApiError');
const employeeTaskRepository = require('../repositories/employeeTask.repository');
const workTeamRepository = require('../repositories/workTeam.repository');
const taskAccess = require('../utils/taskAccess');
const { EMPLOYEE_TASK_TYPE, EMPLOYEE_TASK_STATUS } = require('../config/constants');

// Loads the :id EmployeeTask (populated — see employeeTask.repository.js),
// 404s if missing, then runs the given predicate from taskAccess.js against
// req.user. Predicates may be sync or async — awaiting a plain boolean
// resolves immediately, so this works for both without special-casing.
// Mirrors clientAccess.middleware.js's load-then-predicate shape.
function requireTaskAccess(predicateFn, message) {
  return async (req, res, next) => {
    try {
      const task = await employeeTaskRepository.findById(req.params.id);
      if (!task) return next(ApiError.notFound('Task not found'));
      if (!(await predicateFn(req.user, task))) {
        return next(ApiError.forbidden(message || "You don't have access to this task."));
      }
      req.task = task;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Top-level types whose authority is scoped by `team` — client/event tasks
// carry a `team` field the same way team-type tasks do (see EmployeeTask.js
// and CreateTaskDialog's client->defaultTeam auto-fill), so a leader's
// authority extends to all three, not just 'team'.
const TEAM_SCOPED_TYPES = [EMPLOYEE_TASK_TYPE.TEAM, EMPLOYEE_TASK_TYPE.CLIENT, EMPLOYEE_TASK_TYPE.EVENT];

// Gate for POST /employee-tasks (top-level task creation). Deliberately NOT
// a stored permission grant — a WorkTeam's leader gets this live, the same
// way isTeamLeader already governs their subtask/review/completion
// authority everywhere else, so a newly-appointed leader can create a team
// task immediately without a re-login (permissions are baked into the JWT
// at login) and with no "leader has no login yet" edge case to handle.
// Scoped by their own team: team/client/event tasks tied to a team they
// lead, or a personal task assigning someone on a team they lead (including
// themselves). Must run after body validation (employeeTaskValidator.create)
// so req.body.type/team/assignedEmployees are well-formed by the time this
// reads them.
function requireCanCreateTopLevelTask() {
  return async (req, res, next) => {
    try {
      if (taskAccess.hasFullTaskAccess(req.user)) return next();

      if (TEAM_SCOPED_TYPES.includes(req.body.type) && req.body.team) {
        const team = await workTeamRepository.findById(req.body.team);
        if (team && taskAccess.isTeamLeader(req.user, { team })) return next();
      }

      if (
        req.body.type === EMPLOYEE_TASK_TYPE.PERSONAL &&
        req.body.assignedEmployees?.length === 1 &&
        req.user.employeeLink
      ) {
        const isLeaderOfAssignee = await workTeamRepository.isLeaderOfMember(
          req.user.employeeLink,
          req.body.assignedEmployees[0]
        );
        if (isLeaderOfAssignee) return next();
      }

      return next(ApiError.forbidden("You don't have permission to create this task."));
    } catch (err) {
      next(err);
    }
  };
}

// Same authority as creating a task extends to managing it afterward —
// "whoever could have created this can also edit/delete/continue it."
// Subtasks: unchanged from before, a manage_subtasks holder or the parent
// team's leader (sync, task.team is already copied onto the subtask at
// creation). Top-level: manage_tasks holder, or — new — the team leader for
// team/client/event, or the assignee's team leader for personal (this one
// needs a DB lookup since a personal task carries no team of its own).
async function canManageOwnTask(user, task) {
  if (taskAccess.hasFullTaskAccess(user)) return true;

  if (task.parentTask) {
    return taskAccess.hasSubtaskManageAccess(user) || taskAccess.isTeamLeader(user, task);
  }

  if (task.type === EMPLOYEE_TASK_TYPE.PERSONAL) {
    if (!user.employeeLink || task.assignedEmployees.length !== 1) return false;
    return Boolean(
      await workTeamRepository.isLeaderOfMember(user.employeeLink, taskAccess.toId(task.assignedEmployees[0]))
    );
  }

  return taskAccess.isTeamLeader(user, task);
}

// Gate for DELETE /:id and POST /:id/follow-ups — plain canManageOwnTask,
// no request body to worry about reassigning through.
function requireCanManageTask(message) {
  return requireTaskAccess(canManageOwnTask, message);
}

async function isValidTeamReassignment(user, newTeamId) {
  const team = await workTeamRepository.findById(newTeamId);
  return Boolean(team && taskAccess.isTeamLeader(user, { team }));
}

async function isValidAssigneeReassignment(user, newAssigneeId) {
  if (!user.employeeLink) return false;
  return Boolean(await workTeamRepository.isLeaderOfMember(user.employeeLink, newAssigneeId));
}

// Gate for PATCH /:id — canManageOwnTask, PLUS: a leader (not a full
// manage_tasks holder) can't use an edit to reassign a top-level task to a
// team they don't lead, or a personal task to someone outside a team they
// lead — otherwise an edit would let them route work to/from scope they
// were never granted at creation time.
function requireCanUpdateTask() {
  return async (req, res, next) => {
    try {
      const task = await employeeTaskRepository.findById(req.params.id);
      if (!task) return next(ApiError.notFound('Task not found'));
      if (!(await canManageOwnTask(req.user, task))) {
        return next(ApiError.forbidden("You don't have permission to edit this task."));
      }

      if (!taskAccess.hasFullTaskAccess(req.user)) {
        if (req.body.team && req.body.team !== taskAccess.toId(task.team)) {
          if (!(await isValidTeamReassignment(req.user, req.body.team))) {
            return next(ApiError.forbidden("You can't reassign this task to a team you don't lead."));
          }
        }
        if (
          task.type === EMPLOYEE_TASK_TYPE.PERSONAL &&
          req.body.assignedEmployees?.length === 1 &&
          req.body.assignedEmployees[0] !== taskAccess.toId(task.assignedEmployees[0])
        ) {
          if (!(await isValidAssigneeReassignment(req.user, req.body.assignedEmployees[0]))) {
            return next(ApiError.forbidden("You can't reassign this task to someone outside your team."));
          }
        }
      }

      req.task = task;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Gate for POST /:id/continue. Subtask branch preserves the original rule
// exactly (personal subtasks were never continuable, by anyone — unrelated
// to this change). Top-level branch reuses canManageOwnTask, plus the same
// reassignment guard as requireCanUpdateTask — createContinuation only
// accepts assignedEmployees from the body for personal tasks (team/client/
// event/type are always inherited from the source), so that's the only
// field worth guarding here.
function requireCanCreateContinuation() {
  return async (req, res, next) => {
    try {
      const task = await employeeTaskRepository.findById(req.params.id);
      if (!task) return next(ApiError.notFound('Task not found'));
      if (task.status !== EMPLOYEE_TASK_STATUS.COMPLETED) {
        return next(ApiError.badRequest('Only a completed task can be continued'));
      }

      let allowed;
      if (task.parentTask) {
        allowed =
          task.type !== EMPLOYEE_TASK_TYPE.PERSONAL &&
          (taskAccess.hasSubtaskManageAccess(req.user) || taskAccess.isTeamLeader(req.user, task));
      } else {
        allowed = await canManageOwnTask(req.user, task);
      }
      if (!allowed) return next(ApiError.forbidden("You don't have permission to continue this task."));

      if (
        !taskAccess.hasFullTaskAccess(req.user) &&
        task.type === EMPLOYEE_TASK_TYPE.PERSONAL &&
        req.body.assignedEmployees?.length === 1 &&
        req.body.assignedEmployees[0] !== taskAccess.toId(task.assignedEmployees[0])
      ) {
        if (!(await isValidAssigneeReassignment(req.user, req.body.assignedEmployees[0]))) {
          return next(ApiError.forbidden("You can't reassign this continuation to someone outside your team."));
        }
      }

      req.task = task;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireTaskAccess,
  requireCanCreateTopLevelTask,
  requireCanManageTask,
  requireCanUpdateTask,
  requireCanCreateContinuation,
};
