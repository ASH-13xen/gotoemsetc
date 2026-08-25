const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logger = require('../utils/logger');
const employeeTaskRepository = require('../repositories/employeeTask.repository');
const employeeRepository = require('../repositories/employee.repository');
const employeeTaskNotify = require('./employeeTaskNotify.service');
const emailService = require('./email.service');
const { isAdminLike } = require('../utils/roles');
const { EMPLOYEE_TASK_TYPE, EMPLOYEE_TASK_STATUS, EMPLOYEE_TASK_COMPLETION_FLAG } = require('../config/constants');

// Reuses the same verified HR mailbox from RESEND_FROM_EMAIL, just under a
// different display name — Resend's `from` accepts "Name <address>", and
// env.resend.fromEmail is already in that shape (see email.service.js).
function taskManagerFrom() {
  const match = /<([^>]+)>/.exec(env.resend.fromEmail || '');
  const address = match ? match[1] : env.resend.fromEmail;
  return `Task Manager <${address}>`;
}

// Task Management notifications go to the employee's work inbox, not their
// personal one — stored as a freeform "COMPANY MAIL ID" entry in
// Employee.extraDetails (there's no dedicated schema field for it; HR fills
// it in alongside "COMPANY MAIL PASSWORD" when onboarding). Matched
// case-insensitively since extraDetails keys are hand-typed by HR.
const COMPANY_EMAIL_KEY = 'COMPANY MAIL ID';

function getCompanyEmail(employee) {
  const entry = (employee.extraDetails || []).find(
    (d) => d.key && d.key.trim().toUpperCase() === COMPANY_EMAIL_KEY
  );
  const value = entry?.value?.trim();
  return value || null;
}

// Resolves a mixed list of populated-employee-refs/raw ids down to the
// distinct Employee docs that actually have a company mail ID on file.
async function resolveEmailRecipients(employeeRefs) {
  const uniqueIds = [...new Set((employeeRefs || []).filter(Boolean).map((ref) => (ref._id || ref).toString()))];
  const employees = await Promise.all(uniqueIds.map((id) => employeeRepository.findById(id)));
  return employees.filter((e) => e && getCompanyEmail(e));
}

async function sendPersonalTaskAssignedEmail(task) {
  const employee = await employeeRepository.findById(task.assignedEmployees[0]._id || task.assignedEmployees[0]);
  const companyEmail = employee && getCompanyEmail(employee);
  if (!companyEmail) return;

  const html = `<p>Hi ${employee.firstName},</p>
<p>A new task has been scheduled for you:</p>
<p><strong>${task.title}</strong></p>
${task.description ? `<p>${task.description}</p>` : ''}
<p><strong>Start:</strong> ${new Date(task.startAt).toLocaleString('en-IN')}<br/>
<strong>Due:</strong> ${new Date(task.endAt).toLocaleString('en-IN')}</p>
<p>Thanks,<br/>Task Manager</p>`;

  await emailService.sendEmail({
    to: companyEmail,
    subject: `New task scheduled — ${task.title}`,
    html,
    from: taskManagerFrom(),
  });
}

// Sent to every current assignee of a subtask (any parent type, including
// personal) — a distinct template from the top-level ones, explicit that
// this is a subtask of the parent task rather than a standalone one.
async function sendSubtaskAssignedEmail(subtask, parentTask) {
  const recipients = await resolveEmailRecipients(subtask.assignedEmployees);
  await Promise.all(
    recipients.map((employee) => {
      const html = `<p>Hi ${employee.firstName},</p>
<p>A new subtask has been assigned to you — this is a subtask for "<strong>${parentTask.title}</strong>":</p>
<p><strong>${subtask.title}</strong></p>
${subtask.description ? `<p>${subtask.description}</p>` : ''}
<p><strong>Start:</strong> ${new Date(subtask.startAt).toLocaleString('en-IN')}<br/>
<strong>Due:</strong> ${new Date(subtask.endAt).toLocaleString('en-IN')}</p>
<p>Thanks,<br/>Task Manager</p>`;
      return emailService.sendEmail({
        to: getCompanyEmail(employee),
        subject: `New subtask assigned — ${subtask.title}`,
        html,
        from: taskManagerFrom(),
      });
    })
  );
}

// Sent to the team's leader, every member, and every ad-hoc extra member —
// the same recipient set notifyAssigned() notifies in-app, just also by
// email. Covers team/client/event top-level tasks.
async function sendTeamTaskAssignedEmail(task) {
  const recipients = await resolveEmailRecipients([
    task.team?.leader,
    ...(task.team?.members || []),
    ...(task.extraMembers || []),
  ]);
  const typeLabel = task.type === EMPLOYEE_TASK_TYPE.CLIENT ? 'client' : task.type === EMPLOYEE_TASK_TYPE.EVENT ? 'event' : 'team';
  const context = task.client?.name || task.event?.name || task.team?.name;

  await Promise.all(
    recipients.map((employee) => {
      const html = `<p>Hi ${employee.firstName},</p>
<p>A new ${typeLabel} task has been scheduled${context ? ` for "${context}"` : ''}:</p>
<p><strong>${task.title}</strong></p>
${task.description ? `<p>${task.description}</p>` : ''}
<p><strong>Start:</strong> ${new Date(task.startAt).toLocaleString('en-IN')}<br/>
<strong>Due:</strong> ${new Date(task.endAt).toLocaleString('en-IN')}</p>
<p>Thanks,<br/>Task Manager</p>`;
      return emailService.sendEmail({
        to: getCompanyEmail(employee),
        subject: `New task scheduled — ${task.title}`,
        html,
        from: taskManagerFrom(),
      });
    })
  );
}

// Sent to every current assignee when a for_review task is rejected —
// distinct from the assignment templates, explicit that it needs to be
// redone, carrying whatever new dates were set as part of the rejection.
async function sendTaskRejectedEmail(task, note) {
  const recipients = await resolveEmailRecipients(employeeTaskNotify.taskAssigneeEmployeeIds(task));
  await Promise.all(
    recipients.map((employee) => {
      const html = `<p>Hi ${employee.firstName},</p>
<p>Your submission for "<strong>${task.title}</strong>" was reviewed and needs to be redone.</p>
${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
<p><strong>New start:</strong> ${new Date(task.startAt).toLocaleString('en-IN')}<br/>
<strong>New due:</strong> ${new Date(task.endAt).toLocaleString('en-IN')}</p>
<p>Thanks,<br/>Task Manager</p>`;
      return emailService.sendEmail({
        to: getCompanyEmail(employee),
        subject: `Task reassigned — ${task.title}`,
        html,
        from: taskManagerFrom(),
      });
    })
  );
}

// Client tasks send no email at all — they're generated in bulk by the
// Client Management System's calendar (a diamond client alone produces
// 60-90 daily stories a month, all routed to one social media manager), and
// mailing each one would bury the recipient and burn the send quota. In-app
// notifications still fire for every type. Personal/team/event tasks are
// unaffected.
function sendsEmail(task) {
  return task.type !== EMPLOYEE_TASK_TYPE.CLIENT;
}

// A parent can't be completed while any of its subtasks is still open. The
// Client Management System depends on this — a reel isn't done until both
// the shoot and the edit are — and it's the natural reading of "the task is
// finished" everywhere else too. Scoped to tasks that actually have
// subtasks, so nothing changes for the flat ones.
async function assertSubtasksComplete(task) {
  if (task.parentTask) return; // subtasks have no children of their own

  const subtasks = await employeeTaskRepository.listSubtasks(task._id);
  const open = subtasks.filter(
    (s) => !s.isDeleted && s.status !== EMPLOYEE_TASK_STATUS.COMPLETED
  );
  if (open.length > 0) {
    throw ApiError.badRequest(
      `This task still has ${open.length} incomplete subtask${open.length === 1 ? '' : 's'}: ` +
        `${open.map((s) => s.title).join(', ')}.`
    );
  }
}

// A task gated on another (a reel's edit waiting on its shoot) can't move
// until the blocker is done.
async function assertNotBlocked(task) {
  if (!task.blockedBy) return;

  const blocker = await employeeTaskRepository.findById(task.blockedBy);
  if (blocker && !blocker.isDeleted && blocker.status !== EMPLOYEE_TASK_STATUS.COMPLETED) {
    throw ApiError.badRequest(`"${blocker.title}" has to be completed first.`);
  }
}

// Only fields relevant to `type` survive — e.g. a client-type task never
// carries a stray `event` id, and a personal task never carries a `team`.
function normalizeForType(data) {
  const { type } = data;
  if (type === EMPLOYEE_TASK_TYPE.PERSONAL) {
    return { ...data, team: undefined, extraMembers: [], client: undefined, event: undefined };
  }
  const base = { ...data, assignedEmployees: [] };
  if (type === EMPLOYEE_TASK_TYPE.TEAM) return { ...base, client: undefined, event: undefined };
  if (type === EMPLOYEE_TASK_TYPE.CLIENT) return { ...base, event: undefined };
  if (type === EMPLOYEE_TASK_TYPE.EVENT) return { ...base, client: undefined };
  return base;
}

async function createTask(data, createdByEmployeeId) {
  const payload = { ...normalizeForType(data), status: EMPLOYEE_TASK_STATUS.PENDING, createdBy: createdByEmployeeId };
  const created = await employeeTaskRepository.create(payload);
  const task = await employeeTaskRepository.findById(created._id);

  employeeTaskNotify.notifyAssigned(task).catch((err) => logger.error({ err }, 'notifyAssigned failed'));
  if (sendsEmail(task)) {
    if (task.type === EMPLOYEE_TASK_TYPE.PERSONAL) {
      sendPersonalTaskAssignedEmail(task).catch((err) => logger.error({ err }, 'sendPersonalTaskAssignedEmail failed'));
    } else {
      sendTeamTaskAssignedEmail(task).catch((err) => logger.error({ err }, 'sendTeamTaskAssignedEmail failed'));
    }
  }

  return task;
}

// `actingUser` is optional (existing internal callers that don't need
// meeting-audit logging can omit it) — when the task carries a `meetingRef`,
// the edit is appended to that meeting's `taskEdits[]` so the client manual
// can later say "this task was edited on X". Scoped to only MOM-spawned
// tasks, not a system-wide task audit trail.
async function updateTask(id, data, actingUser) {
  const task = await employeeTaskRepository.updateById(id, data);
  if (!task) throw ApiError.notFound('Task not found');

  if (task.meetingRef && actingUser) {
    const meetingRepository = require('../repositories/meeting.repository');
    await meetingRepository
      .updateById(task.meetingRef.toString(), {
        $push: {
          taskEdits: {
            task: task._id,
            changedFields: Object.keys(data),
            changedAt: new Date(),
            changedBy: actingUser.id,
          },
        },
      })
      .catch((err) => logger.error({ err, taskId: task._id }, 'Failed to log task edit to meeting'));
  }

  return task;
}

async function removeTask(id) {
  const task = await employeeTaskRepository.softDeleteById(id);
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

// parentTask must be a top-level task — subtasks are one level deep, so a
// subtask of a subtask is rejected outright.
async function createSubtask(parentId, data, createdByEmployeeId) {
  const parent = await employeeTaskRepository.findById(parentId);
  if (!parent) throw ApiError.notFound('Task not found');
  if (parent.parentTask) throw ApiError.badRequest('Subtasks can only be created one level deep');

  const payload = {
    ...data,
    type: parent.type,
    team: parent.team?._id,
    client: parent.client?._id,
    event: parent.event?._id,
    parentTask: parent._id,
    status: EMPLOYEE_TASK_STATUS.PENDING,
    createdBy: createdByEmployeeId,
  };
  const created = await employeeTaskRepository.create(payload);
  const subtask = await employeeTaskRepository.findById(created._id);

  employeeTaskNotify.notifyAssigned(subtask).catch((err) => logger.error({ err }, 'notifyAssigned (subtask) failed'));
  if (sendsEmail(subtask)) {
    sendSubtaskAssignedEmail(subtask, parent).catch((err) => logger.error({ err }, 'sendSubtaskAssignedEmail failed'));
  }
  return subtask;
}

function listSubtasks(parentId) {
  return employeeTaskRepository.listSubtasks(parentId);
}

async function addFollowUp(taskId, data) {
  const task = await employeeTaskRepository.addFollowUp(taskId, data);
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

async function toggleFollowUp(taskId, followUpId, isDone, actingEmployeeId) {
  const data = isDone
    ? { isDone: true, completedAt: new Date(), completedBy: actingEmployeeId }
    : { isDone: false, completedAt: null, completedBy: null };
  const task = await employeeTaskRepository.updateFollowUpById(taskId, followUpId, data);
  if (!task) throw ApiError.notFound('Task or follow-up not found');
  return task;
}

async function markForReview(task, actingEmployeeId) {
  await assertNotBlocked(task);
  await assertSubtasksComplete(task);
  const now = new Date();
  const completionFlag =
    now <= new Date(task.endAt) ? EMPLOYEE_TASK_COMPLETION_FLAG.ON_TIME : EMPLOYEE_TASK_COMPLETION_FLAG.LATE;

  const updated = await employeeTaskRepository.updateById(task._id, {
    status: EMPLOYEE_TASK_STATUS.FOR_REVIEW,
    markedForReviewAt: now,
    markedForReviewBy: actingEmployeeId,
    completionFlag,
  });

  employeeTaskNotify.notifyForReview(updated).catch((err) => logger.error({ err }, 'notifyForReview failed'));
  return updated;
}

// Both markCompleted and markCompletedDirect take the full acting *user*
// (not just an employee id) — a CMS-owned subtask's completion may need to
// trigger its linked CalendarItem's pipeline to advance, which needs the
// acting user's role too (admin/CEO override, global Team Leader), not just
// their employee id. See notifyCmsPipelineIfOwned below.
function employeeIdOf(actingUser) {
  return actingUser?.employeeLink || actingUser || null;
}

// If this task was generated by the Client Management System (task.cmsItem
// set) OR is a subtask of a MOM-spawned pipeline task (its parent has
// momPipeline set), completing it may be the pending action on that
// pipeline's current step — advance it. Lazily required to dodge circular
// imports: both the CMS services and momPipeline.service.js already import
// this file the other direction. A mismatch (this task isn't actually the
// pipeline's active step, or someone completed it out of band) is expected
// and harmless — advance() simply won't have anything to do or will no-op
// safely; genuine errors are logged, never thrown, since the task itself is
// already saved as completed by now.
async function notifyCmsPipelineIfOwned(task, actingUser) {
  if (!actingUser || typeof actingUser === 'string') return;
  try {
    if (task.cmsItem) {
      const pipelineBridge = require('./cms/pipelineBridge.service');
      await pipelineBridge.onSubtaskCompleted(task, actingUser);
      return;
    }
    if (task.parentTask) {
      const parent = await employeeTaskRepository.findById(task.parentTask);
      if (parent?.momPipeline?.kind) {
        const momPipelineService = require('./momPipeline.service');
        await momPipelineService.onSubtaskCompleted(parent, task, actingUser);
      }
    }
  } catch (err) {
    logger.error({ err, taskId: task._id }, 'CMS/MOM pipeline bridge failed after subtask completion');
  }
}

// The review-optional counterpart to markForReview — same completionFlag
// computation, but the task lands directly on COMPLETED instead of
// FOR_REVIEW, since nobody needs to sign off on it.
//
// `skipCmsBridge` is set by calendarItem.service.js when it is itself the
// one driving this completion (the calendar-originated "advance" path,
// which is about to handle the CalendarItem's own stage transition right
// after this call returns) — without it, that path would complete the
// subtask, the bridge would fire and call back into advance() to handle the
// very same transition, and then the original caller would try to apply it
// a second time. The Task-Management-originated path (completing a subtask
// directly, not via the calendar) never sets this, so the bridge still runs.
async function markCompletedDirect(task, actingUser, { skipCmsBridge = false } = {}) {
  await assertNotBlocked(task);
  await assertSubtasksComplete(task);
  const now = new Date();
  const completionFlag =
    now <= new Date(task.endAt) ? EMPLOYEE_TASK_COMPLETION_FLAG.ON_TIME : EMPLOYEE_TASK_COMPLETION_FLAG.LATE;

  const updated = await employeeTaskRepository.updateById(task._id, {
    status: EMPLOYEE_TASK_STATUS.COMPLETED,
    completionFlag,
    completedAt: now,
    completedBy: employeeIdOf(actingUser),
  });

  employeeTaskNotify.notifyCompleted(updated).catch((err) => logger.error({ err }, 'notifyCompleted (direct) failed'));
  if (!skipCmsBridge) notifyCmsPipelineIfOwned(updated, actingUser);
  return updated;
}

async function markCompleted(task, actingUser, { skipCmsBridge = false } = {}) {
  await assertSubtasksComplete(task);
  const updated = await employeeTaskRepository.updateById(task._id, {
    status: EMPLOYEE_TASK_STATUS.COMPLETED,
    completedAt: new Date(),
    completedBy: employeeIdOf(actingUser),
  });

  employeeTaskNotify.notifyCompleted(updated).catch((err) => logger.error({ err }, 'notifyCompleted failed'));
  if (!skipCmsBridge) notifyCmsPipelineIfOwned(updated, actingUser);
  return updated;
}

// Sends a for_review task back to pending instead of approving it —
// whoever had completion authority can also apply edits (new dates, a
// tweaked description) in the same action. Review-state fields are cleared
// since they're now stale; a fresh review cycle starts from scratch once
// the assignee marks it for review again.
async function rejectTask(task, edits, actingEmployeeId) {
  const { note, ...fieldEdits } = edits || {};
  const updated = await employeeTaskRepository.updateById(task._id, {
    ...fieldEdits,
    status: EMPLOYEE_TASK_STATUS.PENDING,
    markedForReviewAt: null,
    markedForReviewBy: null,
    completionFlag: null,
  });

  employeeTaskNotify.notifyRejected(updated, note).catch((err) => logger.error({ err }, 'notifyRejected failed'));
  if (sendsEmail(updated)) {
    sendTaskRejectedEmail(updated, note).catch((err) => logger.error({ err }, 'sendTaskRejectedEmail failed'));
  }
  return updated;
}

// A fresh, independently-tracked task linked back to the one it continues
// — type/team/client/event/parentTask are inherited from the source
// (which must already be completed); only the work-defining fields are
// editable. Resources/contacts carry over since the job itself is usually
// the same kind of work; follow-ups start empty (they were specific to the
// original's own timeline).
async function createContinuation(sourceId, edits, createdByEmployeeId) {
  const source = await employeeTaskRepository.findById(sourceId);
  if (!source) throw ApiError.notFound('Task not found');
  if (source.status !== EMPLOYEE_TASK_STATUS.COMPLETED) {
    throw ApiError.badRequest('Only a completed task can be continued');
  }

  const isPersonalOrSubtask = source.type === EMPLOYEE_TASK_TYPE.PERSONAL || Boolean(source.parentTask);
  const payload = {
    title: edits.title || source.title,
    description: edits.description ?? source.description,
    type: source.type,
    startAt: edits.startAt,
    endAt: edits.endAt,
    team: source.team?._id,
    client: source.client?._id,
    event: source.event?._id,
    parentTask: source.parentTask || null,
    assignedEmployees: isPersonalOrSubtask
      ? edits.assignedEmployees || source.assignedEmployees.map((e) => e._id || e)
      : [],
    extraMembers: !isPersonalOrSubtask
      ? (edits.extraMembers ?? source.extraMembers.map((e) => e._id || e))
      : [],
    resourcesRequired: source.resourcesRequired,
    contactsRequired: source.contactsRequired,
    reviewMandatory: edits.reviewMandatory ?? source.reviewMandatory,
    continuesFrom: source._id,
    status: EMPLOYEE_TASK_STATUS.PENDING,
    createdBy: createdByEmployeeId,
  };

  const created = await employeeTaskRepository.create(payload);
  const continuation = await employeeTaskRepository.findById(created._id);

  employeeTaskNotify
    .notifyAssigned(continuation)
    .catch((err) => logger.error({ err }, 'notifyAssigned (continuation) failed'));

  if (continuation.type === EMPLOYEE_TASK_TYPE.PERSONAL) {
    sendPersonalTaskAssignedEmail(continuation).catch((err) =>
      logger.error({ err }, 'sendPersonalTaskAssignedEmail (continuation) failed')
    );
  } else if (continuation.parentTask) {
    const parent = await employeeTaskRepository.findById(continuation.parentTask);
    sendSubtaskAssignedEmail(continuation, parent).catch((err) =>
      logger.error({ err }, 'sendSubtaskAssignedEmail (continuation) failed')
    );
  } else {
    sendTeamTaskAssignedEmail(continuation).catch((err) =>
      logger.error({ err }, 'sendTeamTaskAssignedEmail (continuation) failed')
    );
  }

  return continuation;
}

function getChain(taskId) {
  return employeeTaskRepository.findChain(taskId);
}

function listMine(user, { type } = {}) {
  const isAdmin = isAdminLike(user);
  if (!isAdmin && !user.employeeLink) return [];
  return employeeTaskRepository.listMine({ employeeId: user.employeeLink, isAdmin, type });
}

function listUpcoming(user, { limit } = {}) {
  if (!user.employeeLink) return [];
  return employeeTaskRepository.listUpcomingForEmployee(user.employeeLink, { limit });
}

async function listReview(user) {
  if (isAdminLike(user)) {
    return { isReviewer: true, tasks: await employeeTaskRepository.listAllForReview() };
  }
  if (!user.employeeLink) return { isReviewer: false, tasks: [] };

  const scope = await employeeTaskRepository.getReviewScope(user.employeeLink);
  const isReviewer = scope.reportIds.length > 0 || scope.ledTeamIds.length > 0;
  const tasks = isReviewer ? await employeeTaskRepository.listReviewForScope(scope) : [];
  return { isReviewer, tasks };
}

// Backs the admin unified task view's filter bar — client/team/employee/
// date, any combination active at once.
function adminFilter({ clientId, teamId, employeeId, dateFrom, dateTo }) {
  return employeeTaskRepository.listForAdminFiltered({ clientId, teamId, employeeId, dateFrom, dateTo });
}

module.exports = {
  taskManagerFrom,
  createTask,
  updateTask,
  removeTask,
  createSubtask,
  listSubtasks,
  addFollowUp,
  toggleFollowUp,
  markForReview,
  markCompletedDirect,
  markCompleted,
  rejectTask,
  createContinuation,
  getChain,
  listMine,
  listUpcoming,
  listReview,
  adminFilter,
};
