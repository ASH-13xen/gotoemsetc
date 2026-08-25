const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const calendarItemRepository = require('../repositories/calendarItem.repository');
const clientCalendarRepository = require('../repositories/clientCalendar.repository');
const employeeTaskRepository = require('../repositories/employeeTask.repository');
const employeeTaskService = require('./employeeTask.service');
const cmsWorkflow = require('./cmsWorkflow.service');
const cmsPipelines = require('../config/cmsPipelines');
const cmsNotify = require('./cmsNotify.service');
const cmsAccess = require('../utils/cmsAccess');
const teamRoles = require('../utils/teamRoles');
const istDate = require('../utils/istDate');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const {
  CMS_CONTENT_TYPE,
  CMS_TASK_ROLE,
  EMPLOYEE_TASK_TYPE,
  EMPLOYEE_TASK_STATUS,
} = require('../config/constants');

const { toId } = cmsAccess;

// Where each CMS_TASK_ROLE's subtask id lives on CalendarItem.subtaskRefs.
// DESIGN (post) and STORY (daily story) share `.design` — the two never
// coexist on the same item, since they belong to different `type`s.
const SUBTASK_REF_KEY = {
  [CMS_TASK_ROLE.DESIGN]: 'design',
  [CMS_TASK_ROLE.STORY]: 'design',
  [CMS_TASK_ROLE.VIDEOGRAPHER]: 'shoot',
  [CMS_TASK_ROLE.EDITOR]: 'edit',
  [CMS_TASK_ROLE.CONTENT_MANAGER]: 'contentManager',
};

const SUBTASK_LABEL = {
  [CMS_TASK_ROLE.DESIGN]: 'Design',
  [CMS_TASK_ROLE.STORY]: 'Create',
  [CMS_TASK_ROLE.VIDEOGRAPHER]: 'Videographer',
  [CMS_TASK_ROLE.EDITOR]: 'Editor',
  [CMS_TASK_ROLE.CONTENT_MANAGER]: 'Content Manager',
};

// Task window for everything the calendar generates, per spec: work opens at
// 09:30 IST on the 1st of the month (or now, if the item is created later in
// the month) and is due at 18:30 IST on the scheduled day.
//
// Backfilling is explicitly allowed, so a scheduled date in the past is
// legal — it just makes the month-start rule nonsensical, since the deadline
// would precede the start. In that case the window collapses to the
// scheduled day itself.
function taskWindow(calendar, scheduledDate) {
  const endAt = istDate.istAt(scheduledDate, 18, 30);
  const monthStart = istDate.istInstant(calendar.year, calendar.month, 1, 9, 30);
  const now = new Date();

  let startAt = monthStart > now ? monthStart : now;
  if (startAt > endAt) startAt = istDate.istAt(scheduledDate, 9, 30);

  return { startAt, endAt };
}

// Which subtasks a pipeline breaks into, derived straight from
// config/cmsPipelines.js rather than hand-written per type — every step with
// a `subtaskRole` gets one, in pipeline order, each blocked by the previous
// subtask-bearing step (skipping over any pure-review steps in between, e.g.
// a Reel's Content Manager subtask is blocked by Editor's even though an SMM
// approval click sits between them in the full sequence).
function subtaskPlan(item, team) {
  const kind = cmsWorkflow.pipelineKindFor(item);
  const steps = cmsPipelines.stepsFor(kind).filter((s) => s.subtaskRole);

  const plans = [];
  let previousRole = null;
  for (const step of steps) {
    let assignees =
      step.actor.type === 'team_role'
        ? teamRoles.membersWithRole(team, step.actor.role)
        : [toId(item.assignments?.[step.actor.field])].filter(Boolean);

    // Nobody tagged for a collective role yet — the work still has to
    // belong to somebody, so it falls back to Team Main (only ever matters
    // for a daily story's smm_done, the one collective-role step that has a
    // subtask at all).
    if (step.actor.type === 'team_role' && assignees.length === 0 && team?.leader) {
      assignees = [toId(team.leader)];
    }

    plans.push({ role: step.subtaskRole, label: SUBTASK_LABEL[step.subtaskRole], assignees, blockedByRole: previousRole });
    previousRole = step.subtaskRole;
  }
  return plans;
}

// A daily story's parent task is shared with every other day of the month,
// so the day's own subtask is what its stage, rescheduling and deletion act
// on. Everything else owns its parent outright.
function isSharedParent(item) {
  return item.type === CMS_CONTENT_TYPE.STORY;
}

// The task(s) this item owns outright — cascaded on delete, moved on
// reschedule, reopened on send-back. Never includes a shared parent, which
// belongs to the month rather than to any one day.
function ownedTaskIds(item) {
  const ids = isSharedParent(item)
    ? [item.subtaskRefs?.design]
    : [item.task, item.subtaskRefs?.design, item.subtaskRefs?.shoot, item.subtaskRefs?.edit, item.subtaskRefs?.contentManager];
  return ids.filter(Boolean).map(toId);
}

function assertAssignments(type, festiveWorkflow, assignments) {
  const kind = type === CMS_CONTENT_TYPE.FESTIVE_STORY ? festiveWorkflow : type;
  if (type === CMS_CONTENT_TYPE.FESTIVE_STORY && !festiveWorkflow) {
    throw ApiError.badRequest('Choose whether this festive story follows the Post or Reel workflow.');
  }
  if (kind === CMS_CONTENT_TYPE.REEL) {
    if (!assignments.shooter) throw ApiError.badRequest('A reel needs someone assigned as videographer.');
    if (!assignments.editor) throw ApiError.badRequest('A reel needs someone assigned as editor.');
    if (!assignments.contentManager) throw ApiError.badRequest('A reel needs someone assigned as content manager.');
    return;
  }
  if (kind === CMS_CONTENT_TYPE.POST) {
    if (!assignments.designer) throw ApiError.badRequest('A post needs one social media manager assigned.');
  }
  // A daily story has no per-item assignment to validate — it routes to
  // every team member currently tagged Social Media Manager, resolved live.
}

// Schedules one piece of content: creates the calendar item, then the client
// task and its subtasks in Task Management, then links them together.
//
// The item is created first because every task it spawns carries a cmsItem
// back-reference (that reference is what marks a task CMS-owned and keeps it
// from being created or deleted directly in Task Management).
async function scheduleItem(calendar, input, actingUser, { team } = {}) {
  const resolvedTeam = team || calendar.team;
  if (!resolvedTeam) throw ApiError.badRequest('This calendar has no team assigned.');

  const { type, scheduledDate, festiveWorkflow } = input;
  const assignments = input.assignments || {};
  assertAssignments(type, festiveWorkflow, assignments);

  if (!istDate.isInIstMonth(scheduledDate, calendar.year, calendar.month)) {
    throw ApiError.badRequest("That date isn't in this calendar's month.");
  }

  const index = await calendarItemRepository.nextIndexForType(calendar._id, type);

  const created = await calendarItemRepository.create({
    calendar: calendar._id,
    client: toId(calendar.client),
    type,
    festiveWorkflow: type === CMS_CONTENT_TYPE.FESTIVE_STORY ? festiveWorkflow : null,
    index,
    scheduledDate: istDate.istAt(scheduledDate, 18, 30),
    brief: input.brief || {},
    assignments,
    stage: 'created',
    createdBy: actingUser.employeeLink || null,
  });

  const item = await calendarItemRepository.findById(created._id);
  const label = cmsWorkflow.labelFor(item);
  const { startAt, endAt } = taskWindow(calendar, item.scheduledDate);

  // Daily stories all hang off one shared monthly task; everything else gets
  // its own. See ensureDailyStoryTask for why.
  const task = isSharedParent(item)
    ? await ensureDailyStoryTask(calendar, resolvedTeam, actingUser)
    : await employeeTaskService.createTask(
        {
          title: label,
          description: input.brief?.postingName || '',
          type: EMPLOYEE_TASK_TYPE.CLIENT,
          startAt,
          endAt,
          team: toId(resolvedTeam),
          client: toId(calendar.client),
          cmsItem: item._id,
          reviewMandatory: false,
        },
        actingUser.employeeLink || null
      );

  const subtaskRefs = {};
  const createdByRole = {};
  for (const plan of subtaskPlan(item, resolvedTeam)) {
    if (plan.assignees.length === 0) continue; // nobody tagged yet — added once someone is
    const subtask = await employeeTaskService.createSubtask(
      task._id,
      {
        // A day's story subtask is titled by its date, since its siblings are
        // every other day of the same month.
        title: isSharedParent(item)
          ? `Stories — ${istDate.istDateKey(item.scheduledDate)}`
          : `${plan.label} — ${label}`,
        startAt,
        endAt,
        assignedEmployees: plan.assignees,
        cmsItem: item._id,
        cmsRole: plan.role,
        // The next doer can't start until the one before them is done.
        // Resolved from the already-created subtask rather than a second
        // pass, which is why subtaskPlan returns roles in pipeline order.
        blockedBy: plan.blockedByRole ? createdByRole[plan.blockedByRole] : null,
        reviewMandatory: false,
      },
      actingUser.employeeLink || null
    );
    createdByRole[plan.role] = subtask._id;
    subtaskRefs[SUBTASK_REF_KEY[plan.role]] = subtask._id;
  }

  return calendarItemRepository.updateById(item._id, { task: task._id, subtaskRefs });
}

// One "Daily Stories — <Month>" task per calendar, created on first use and
// reused by every subsequent day. Marked CMS-owned via cmsCalendar rather
// than cmsItem, since it belongs to the month rather than to any single day.
//
// Guarded against the concurrent case (the month generator creates 28-31 days
// in a loop) by re-reading the calendar rather than trusting the copy passed
// in, which goes stale the moment the first day creates the task.
async function ensureDailyStoryTask(calendar, team, actingUser) {
  const fresh = await clientCalendarRepository.findById(calendar._id);
  if (fresh?.dailyStoryTask) {
    const existing = await employeeTaskRepository.findById(toId(fresh.dailyStoryTask));
    if (existing && !existing.isDeleted) return existing;
  }

  const monthLabel = `${MONTH_NAMES[calendar.month - 1]} ${calendar.year}`;
  const task = await employeeTaskService.createTask(
    {
      title: `Daily Stories — ${monthLabel}`,
      description: 'One subtask per day. Each day is ticked off as its stories go out.',
      type: EMPLOYEE_TASK_TYPE.CLIENT,
      // Spans the whole month: opens with it and closes on the last day.
      startAt: taskWindow(calendar, istDate.istInstant(calendar.year, calendar.month, 1, 12, 0)).startAt,
      endAt: istDate.istInstant(
        calendar.year,
        calendar.month,
        istDate.istDaysInMonth(calendar.year, calendar.month),
        18,
        30
      ),
      team: toId(team),
      client: toId(calendar.client),
      cmsCalendar: calendar._id,
      reviewMandatory: false,
    },
    actingUser.employeeLink || null
  );

  await clientCalendarRepository.updateById(calendar._id, { dailyStoryTask: task._id });
  return task;
}

async function getItem(id) {
  const item = await calendarItemRepository.findById(id);
  if (!item) throw ApiError.notFound('Scheduled item not found');
  return item;
}

// The read-facing shape: the raw item plus its label/colour/step-trail
// resolved server-side, exactly like getCalendarView does for a whole
// month — so the CMS item panel and the Task Management pipeline stepper
// (frontendfollowups calls this same endpoint for a client task's linked
// item) can never draw a different colour or step list than each other.
async function getItemView(id) {
  const item = await getItem(id);
  const now = new Date();
  return {
    ...item.toObject(),
    label: cmsWorkflow.labelFor(item),
    color: cmsWorkflow.colorFor(item, now),
    trail: cmsWorkflow.stepTrail(item),
  };
}

// Editing the brief never touches the pipeline — the whole point of the
// brief fields is that they can be filled in at any time, including after
// the item has moved past its first step.
async function updateBrief(id, brief) {
  const item = await getItem(id);
  const merged = { ...(item.brief?.toObject?.() ?? item.brief ?? {}), ...brief };
  return calendarItemRepository.updateById(id, { brief: merged });
}

// Moving an item moves its whole task tree with it — leaving the tasks on
// the old deadline is what would make the two views disagree.
async function reschedule(id, newDate) {
  const item = await getItem(id);
  const calendar = await clientCalendarRepository.findById(toId(item.calendar));
  if (!calendar) throw ApiError.notFound('Calendar not found');

  if (!istDate.isInIstMonth(newDate, calendar.year, calendar.month)) {
    throw ApiError.badRequest("That date isn't in this calendar's month.");
  }

  const scheduledDate = istDate.istAt(newDate, 18, 30);
  const { startAt, endAt } = taskWindow(calendar, scheduledDate);

  for (const taskId of ownedTaskIds(item)) {
    await employeeTaskRepository.updateById(taskId, { startAt, endAt });
  }

  return calendarItemRepository.updateById(id, { scheduledDate });
}

// Reassigning a subtask — used both for ordinary changes and to hand
// send-back/reject work to someone else.
async function reassign(id, { designer, shooter, editor, contentManager }) {
  const item = await getItem(id);
  const assignments = { ...(item.assignments?.toObject?.() ?? item.assignments ?? {}) };

  const pairs = [
    ['designer', designer, item.type === CMS_CONTENT_TYPE.REEL ? null : 'design'],
    ['shooter', shooter, 'shoot'],
    ['editor', editor, 'edit'],
    ['contentManager', contentManager, 'contentManager'],
  ];

  for (const [field, employeeId, refKey] of pairs) {
    if (!employeeId || !refKey) continue;
    assignments[field] = employeeId;
    const subtaskId = item.subtaskRefs?.[refKey];
    if (subtaskId) {
      await employeeTaskRepository.updateById(toId(subtaskId), { assignedEmployees: [employeeId] });
    }
  }

  return calendarItemRepository.updateById(id, { assignments });
}

// Removes the item and its whole task tree together. Soft deletes throughout,
// matching how everything else in this codebase retires records.
async function deleteItem(id) {
  const item = await calendarItemRepository.findById(id);
  if (!item) throw ApiError.notFound('Scheduled item not found');

  for (const taskId of ownedTaskIds(item)) {
    await employeeTaskRepository.softDeleteById(taskId).catch((err) =>
      logger.error({ err, taskId }, 'Failed to soft-delete CMS-owned task')
    );
  }

  return calendarItemRepository.softDeleteById(id);
}

// ---------------------------------------------------------------------
// Pipeline transitions
// ---------------------------------------------------------------------

function historyEntry({ from, to, action, user, onBehalfOf, note }) {
  return {
    from,
    to,
    action,
    byUser: user.id,
    byEmployee: user.employeeLink || null,
    onBehalfOf: onBehalfOf || undefined,
    note,
    at: new Date(),
  };
}

async function loadTeam(item) {
  const calendar = await clientCalendarRepository.findById(toId(item.calendar));
  return calendar?.team;
}

// Completes the subtask backing `step`, if it has one and it isn't already
// done — the "two entry points, one action" convergence point. Called both
// when advancing from the calendar (which should also flip the subtask) and,
// harmlessly, when the subtask was what triggered this call in the first
// place (see services/cms/pipelineBridge.service.js), in which case it's
// already completed and this is a no-op.
async function completeBackingSubtaskIfAny(item, step, actingUser) {
  if (!step.subtaskRole) return;
  const refKey = SUBTASK_REF_KEY[step.subtaskRole];
  const subtaskId = item.subtaskRefs?.[refKey];
  if (!subtaskId) return;

  const subtask = await employeeTaskRepository.findById(toId(subtaskId));
  if (!subtask || subtask.isDeleted || subtask.status === EMPLOYEE_TASK_STATUS.COMPLETED) return;

  await employeeTaskService.markCompletedDirect(subtask, actingUser, { skipCmsBridge: true });
}

// The current step's actor marks it done. Drives the whole pipeline —
// resolves the next step, completes its backing subtask if any, applies any
// same-person auto-skip, and advances the stage.
async function advance(id, actingUser, { note } = {}) {
  const item = await getItem(id);
  const team = await loadTeam(item);

  if (!cmsWorkflow.canActOnCurrentStep(actingUser, item, team)) {
    throw ApiError.forbidden("You don't have permission to complete this step.");
  }

  const step = cmsWorkflow.nextStepConfig(item);
  if (!step) throw ApiError.badRequest('This item is already at its final step.');

  await completeBackingSubtaskIfAny(item, step, actingUser);

  const onBehalfOf = cmsWorkflow.actingOnBehalfOf(actingUser, item, team);
  const skips = cmsWorkflow.autoSkipsFor({ ...item, stage: step.key }, team, actingUser);
  const toStage = skips.length ? skips[skips.length - 1] : step.key;
  const reachedTerminal = cmsWorkflow.isTerminal({ ...item, stage: toStage });

  const updated = await calendarItemRepository.updateById(id, {
    stage: toStage,
    isSentBack: false,
    submittedAt: item.submittedAt || new Date(),
    ...(reachedTerminal ? { publishedAt: new Date(), publishedBy: actingUser.employeeLink || null } : {}),
    $push: {
      stageHistory: historyEntry({ from: item.stage, to: toStage, action: 'advance', user: actingUser, onBehalfOf, note }),
    },
  });

  cmsNotify.notifyStepPending(updated, team).catch((err) => logger.error({ err }, 'notifyStepPending failed'));
  if (reachedTerminal) {
    cmsNotify.notifyPublished(updated, team).catch((err) => logger.error({ err }, 'notifyPublished failed'));
  }
  return updated;
}

// Pink — whoever is authorized at the current step can instead send the item
// back one step. Reopens the step just completed if it was backed by a
// subtask (someone actually has to redo the work), then reverts the stage.
async function sendBack(id, actingUser, { note } = {}) {
  const item = await getItem(id);
  const team = await loadTeam(item);

  if (!cmsWorkflow.canActOnCurrentStep(actingUser, item, team)) {
    throw ApiError.forbidden("You don't have permission to send this item back.");
  }

  const steps = cmsPipelines.stepsFor(cmsWorkflow.pipelineKindFor(item));
  const currentIndex = cmsPipelines.currentStepIndex(item);
  if (currentIndex === 0) throw ApiError.badRequest('This item is already at its first step.');

  const currentStep = steps[currentIndex];
  if (currentStep.subtaskRole) {
    const refKey = SUBTASK_REF_KEY[currentStep.subtaskRole];
    const subtaskId = item.subtaskRefs?.[refKey];
    if (subtaskId) {
      await employeeTaskRepository
        .updateById(toId(subtaskId), {
          status: EMPLOYEE_TASK_STATUS.PENDING,
          markedForReviewAt: null,
          markedForReviewBy: null,
          completedAt: null,
          completedBy: null,
          completionFlag: null,
        })
        .catch((err) => logger.error({ err, subtaskId }, 'Failed to reopen CMS-owned subtask'));
    }
  }

  const toStage = steps[currentIndex - 1].key;
  const onBehalfOf = cmsWorkflow.actingOnBehalfOf(actingUser, item, team);

  const updated = await calendarItemRepository.updateById(id, {
    stage: toStage,
    isSentBack: true,
    $push: {
      stageHistory: historyEntry({ from: item.stage, to: toStage, action: 'send_back', user: actingUser, onBehalfOf, note }),
    },
  });

  cmsNotify.notifySentBack(updated, team, note).catch((err) => logger.error({ err }, 'notifySentBack failed'));
  return updated;
}

// Red — terminal, closes the item for everyone. Requires a reason; the
// client-side confirmation warning happens before this is ever called.
async function reject(id, actingUser, { reason }) {
  const item = await getItem(id);
  const team = await loadTeam(item);

  if (!cmsWorkflow.canActOnCurrentStep(actingUser, item, team)) {
    throw ApiError.forbidden("You don't have permission to reject this item.");
  }
  if (!reason?.trim()) throw ApiError.badRequest('A reason is required when rejecting.');

  const onBehalfOf = cmsWorkflow.actingOnBehalfOf(actingUser, item, team);

  const updated = await calendarItemRepository.updateById(id, {
    isRejected: true,
    lastRejection: { fromStage: item.stage, reason, by: actingUser.id, at: new Date() },
    $push: {
      stageHistory: historyEntry({ from: item.stage, to: item.stage, action: 'reject', user: actingUser, onBehalfOf, note: reason }),
    },
  });

  cmsNotify.notifyRejected(updated, team, reason).catch((err) => logger.error({ err }, 'notifyRejected failed'));
  return updated;
}

module.exports = {
  SUBTASK_REF_KEY,
  scheduleItem,
  ensureDailyStoryTask,
  ownedTaskIds,
  getItem,
  getItemView,
  updateBrief,
  reschedule,
  reassign,
  deleteItem,
  advance,
  sendBack,
  reject,
  taskWindow,
};
