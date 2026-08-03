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
  if (task.type === EMPLOYEE_TASK_TYPE.PERSONAL) {
    sendPersonalTaskAssignedEmail(task).catch((err) => logger.error({ err }, 'sendPersonalTaskAssignedEmail failed'));
  } else {
    sendTeamTaskAssignedEmail(task).catch((err) => logger.error({ err }, 'sendTeamTaskAssignedEmail failed'));
  }

  return task;
}

async function updateTask(id, data) {
  const task = await employeeTaskRepository.updateById(id, data);
  if (!task) throw ApiError.notFound('Task not found');
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
  sendSubtaskAssignedEmail(subtask, parent).catch((err) => logger.error({ err }, 'sendSubtaskAssignedEmail failed'));
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

// The review-optional counterpart to markForReview — same completionFlag
// computation, but the task lands directly on COMPLETED instead of
// FOR_REVIEW, since nobody needs to sign off on it.
async function markCompletedDirect(task, actingEmployeeId) {
  const now = new Date();
  const completionFlag =
    now <= new Date(task.endAt) ? EMPLOYEE_TASK_COMPLETION_FLAG.ON_TIME : EMPLOYEE_TASK_COMPLETION_FLAG.LATE;

  const updated = await employeeTaskRepository.updateById(task._id, {
    status: EMPLOYEE_TASK_STATUS.COMPLETED,
    completionFlag,
    completedAt: now,
    completedBy: actingEmployeeId,
  });

  employeeTaskNotify.notifyCompleted(updated).catch((err) => logger.error({ err }, 'notifyCompleted (direct) failed'));
  return updated;
}

async function markCompleted(task, actingEmployeeId) {
  const updated = await employeeTaskRepository.updateById(task._id, {
    status: EMPLOYEE_TASK_STATUS.COMPLETED,
    completedAt: new Date(),
    completedBy: actingEmployeeId,
  });

  employeeTaskNotify.notifyCompleted(updated).catch((err) => logger.error({ err }, 'notifyCompleted failed'));
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
  sendTaskRejectedEmail(updated, note).catch((err) => logger.error({ err }, 'sendTaskRejectedEmail failed'));
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

// Backs the admin unified task view's "Filter by Employee"/"Filter by Team"
// controls — the validator guarantees exactly one of the two is present.
function adminFilter({ employeeId, teamId }) {
  if (employeeId) return employeeTaskRepository.listForEmployeeAdmin(employeeId);
  return employeeTaskRepository.listForTeamAdmin(teamId);
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
