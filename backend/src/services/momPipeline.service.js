const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const employeeTaskRepository = require('../repositories/employeeTask.repository');
const employeeTaskService = require('./employeeTask.service');
const workTeamRepository = require('../repositories/workTeam.repository');
const momPipeline = require('../utils/momPipeline');
const { CMS_TASK_ROLE, EMPLOYEE_TASK_STATUS, MOM_PIPELINE_KIND } = require('../config/constants');

const SUBTASK_LABEL = {
  [CMS_TASK_ROLE.DESIGN]: 'Design',
  [CMS_TASK_ROLE.VIDEOGRAPHER]: 'Videographer',
  [CMS_TASK_ROLE.EDITOR]: 'Editor',
  [CMS_TASK_ROLE.CONTENT_MANAGER]: 'Content Manager',
};

async function loadTeam(task) {
  if (!task.team) return null;
  const teamId = task.team._id || task.team;
  return workTeamRepository.findById(teamId);
}

// Creates the subtasks a Post/Reel momPipeline needs (Custom kinds get
// none — a single directly-assigned actor per step, no Task Management
// record beyond the parent itself), sequentially blocked exactly like the
// calendar-driven equivalent.
async function createSubtasksFor(task, momPipelineData, actingUser) {
  if (momPipelineData.kind === MOM_PIPELINE_KIND.CUSTOM) return;

  const plans = momPipeline.subtaskPlanFor(momPipelineData.kind, momPipelineData.assignments);
  const createdByRole = {};
  for (const plan of plans) {
    const subtask = await employeeTaskService.createSubtask(
      task._id,
      {
        title: `${SUBTASK_LABEL[plan.role]} — ${task.title}`,
        startAt: task.startAt,
        endAt: task.endAt,
        assignedEmployees: [plan.assignee],
        cmsRole: plan.role,
        blockedBy: plan.blockedByRole ? createdByRole[plan.blockedByRole] : null,
        reviewMandatory: false,
      },
      actingUser.employeeLink || null
    );
    createdByRole[plan.role] = subtask._id;
  }
}

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

// Completes the subtask backing `step`, if any and not already done — same
// "two entry points, one action" convergence as calendarItem.service.js.
async function completeBackingSubtaskIfAny(task, step, actingUser) {
  if (!step.subtaskRole) return;
  const subtasks = await employeeTaskRepository.listSubtasks(task._id);
  const subtask = subtasks.find((s) => s.cmsRole === step.subtaskRole && !s.isDeleted);
  if (!subtask || subtask.status === EMPLOYEE_TASK_STATUS.COMPLETED) return;
  await employeeTaskService.markCompletedDirect(subtask, actingUser, { skipCmsBridge: true });
}

async function advance(taskId, actingUser, { note } = {}) {
  const task = await employeeTaskRepository.findById(taskId);
  if (!task?.momPipeline?.kind) throw ApiError.notFound('Pipeline task not found');
  const team = await loadTeam(task);

  if (!momPipeline.canActOnCurrentStep(actingUser, task.momPipeline, team)) {
    throw ApiError.forbidden("You don't have permission to complete this step.");
  }

  const step = momPipeline.nextStepConfig(task.momPipeline);
  if (!step) throw ApiError.badRequest('This task is already at its final step.');

  await completeBackingSubtaskIfAny(task, step, actingUser);

  const updated = await employeeTaskRepository.updateById(taskId, {
    'momPipeline.stage': step.key,
    'momPipeline.isSentBack': false,
    $push: {
      'momPipeline.stageHistory': historyEntry({ from: task.momPipeline.stage, to: step.key, action: 'advance', user: actingUser, note }),
    },
  });
  return updated;
}

async function sendBack(taskId, actingUser, { note } = {}) {
  const task = await employeeTaskRepository.findById(taskId);
  if (!task?.momPipeline?.kind) throw ApiError.notFound('Pipeline task not found');
  const team = await loadTeam(task);

  if (!momPipeline.canActOnCurrentStep(actingUser, task.momPipeline, team)) {
    throw ApiError.forbidden("You don't have permission to send this task back.");
  }

  const steps = momPipeline.stepsFor(task.momPipeline);
  const currentIndex = momPipeline.currentStepIndex(task.momPipeline);
  if (currentIndex === 0) throw ApiError.badRequest('This task is already at its first step.');

  const currentStep = steps[currentIndex];
  if (currentStep.subtaskRole) {
    const subtasks = await employeeTaskRepository.listSubtasks(taskId);
    const subtask = subtasks.find((s) => s.cmsRole === currentStep.subtaskRole && !s.isDeleted);
    if (subtask) {
      await employeeTaskRepository
        .updateById(subtask._id, {
          status: EMPLOYEE_TASK_STATUS.PENDING,
          markedForReviewAt: null,
          markedForReviewBy: null,
          completedAt: null,
          completedBy: null,
          completionFlag: null,
        })
        .catch((err) => logger.error({ err, subtaskId: subtask._id }, 'Failed to reopen MOM-pipeline subtask'));
    }
  }

  const toStage = steps[currentIndex - 1].key;
  const updated = await employeeTaskRepository.updateById(taskId, {
    'momPipeline.stage': toStage,
    'momPipeline.isSentBack': true,
    $push: {
      'momPipeline.stageHistory': historyEntry({ from: task.momPipeline.stage, to: toStage, action: 'send_back', user: actingUser, note }),
    },
  });
  return updated;
}

async function reject(taskId, actingUser, { reason }) {
  const task = await employeeTaskRepository.findById(taskId);
  if (!task?.momPipeline?.kind) throw ApiError.notFound('Pipeline task not found');
  const team = await loadTeam(task);

  if (!momPipeline.canActOnCurrentStep(actingUser, task.momPipeline, team)) {
    throw ApiError.forbidden("You don't have permission to reject this task.");
  }
  if (!reason?.trim()) throw ApiError.badRequest('A reason is required when rejecting.');

  const updated = await employeeTaskRepository.updateById(taskId, {
    'momPipeline.isRejected': true,
    'momPipeline.lastRejection': { fromStage: task.momPipeline.stage, reason, by: actingUser.id, at: new Date() },
    $push: {
      'momPipeline.stageHistory': historyEntry({
        from: task.momPipeline.stage,
        to: task.momPipeline.stage,
        action: 'reject',
        user: actingUser,
        note: reason,
      }),
    },
  });
  return updated;
}

// A subtask under a MOM-pipeline parent just got completed in Task
// Management — if it's the one backing the parent's currently-active step,
// that completion IS the pending action. See employeeTask.service.js#
// notifyCmsPipelineIfOwned for the other entry point.
async function onSubtaskCompleted(parentTask, subtask, actingUser) {
  const step = momPipeline.nextStepConfig(parentTask.momPipeline);
  if (!step?.subtaskRole || step.subtaskRole !== subtask.cmsRole) return;

  const team = await loadTeam(parentTask);
  if (!momPipeline.canActOnCurrentStep(actingUser, parentTask.momPipeline, team)) return;

  await advance(parentTask._id, actingUser, {});
}

module.exports = { createSubtasksFor, advance, sendBack, reject, onSubtaskCompleted };
