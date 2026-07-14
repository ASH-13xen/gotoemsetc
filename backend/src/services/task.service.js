const ApiError = require('../utils/ApiError');
const { STEP_STATUS, APPROVAL_STATUS, TASK_STATUS } = require('../config/constants');
const Task = require('../models/Task');
const taskRepository = require('../repositories/task.repository');
const taskCycleRepository = require('../repositories/taskCycle.repository');
const clientRepository = require('../repositories/client.repository');
const taskMessageRepository = require('../repositories/taskMessage.repository');
const clientActivity = require('./clientActivity.service');
const taskNotify = require('./taskNotify.service');
const taskCycleService = require('./taskCycle.service');

async function getTask(id) {
  const task = await taskRepository.findById(id);
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

// Current-cycle view is what the client task page shows by default;
// `cycleId` lets it page back through history ("keep track of previous
// months as well").
async function listForClient(clientId, cycleId) {
  const client = await clientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');

  const cycles = await taskCycleService.listCyclesForClient(clientId);
  const targetCycle = cycleId ? cycles.find((c) => c._id.toString() === cycleId) : cycles[0];
  if (!targetCycle) return { cycles, cycle: null, tasks: [] };

  const tasks = await taskRepository.listForCycle(clientId, targetCycle._id);
  return { cycles, cycle: targetCycle, tasks };
}

// Recomputes the parent task's overall status from its steps — but never
// overwrites a cycle-management status (missed/rolled_over), which is only
// ever set by taskCycle.service.js.
function deriveTaskStatus(currentStatus, steps) {
  if (currentStatus === TASK_STATUS.MISSED || currentStatus === TASK_STATUS.ROLLED_OVER) return currentStatus;
  if (steps.every((s) => s.status === STEP_STATUS.DONE)) return TASK_STATUS.DONE;
  if (steps.some((s) => s.status !== STEP_STATUS.TODO)) return TASK_STATUS.IN_PROGRESS;
  return TASK_STATUS.PENDING;
}

async function updateAssignment(taskId, { assignedTeam, assignedEmployees, leadEmployee }) {
  const task = await taskRepository.findRaw(taskId);
  if (!task) throw ApiError.notFound('Task not found');

  const updated = await taskRepository.updateById(taskId, { assignedTeam, assignedEmployees, leadEmployee });
  const client = await clientRepository.findById(task.client);
  if (client) {
    await taskNotify.notifyTaskAssignment(updated, client);
    await clientActivity.log(task.client, 'TASK_ASSIGNED', { itemLabel: task.itemLabel, sectionName: task.sectionName });
  }
  return updated;
}

function findStep(task, stepId) {
  const step = task.steps.id(stepId);
  if (!step) throw ApiError.notFound('Step not found');
  return step;
}

async function updateStepAssignment(taskId, stepId, { assignedEmployees, dueDate, requiresApproval }) {
  const task = await taskRepository.findRaw(taskId);
  if (!task) throw ApiError.notFound('Task not found');
  const step = findStep(task, stepId);

  if (assignedEmployees !== undefined) step.assignedEmployees = assignedEmployees;
  if (dueDate !== undefined) step.dueDate = dueDate;
  if (requiresApproval !== undefined) {
    step.requiresApproval = requiresApproval;
    if (requiresApproval && step.approvalStatus === APPROVAL_STATUS.NOT_REQUIRED) {
      step.approvalStatus = APPROVAL_STATUS.PENDING;
    }
    if (!requiresApproval) step.approvalStatus = APPROVAL_STATUS.NOT_REQUIRED;
  }
  await task.save();

  const client = await clientRepository.findById(task.client);
  if (client && assignedEmployees?.length) {
    await taskNotify.notifyStepAssignment(task, client, step);
  }
  return taskRepository.findById(taskId);
}

async function updateStepStatus(taskId, stepId, status, actingEmployeeId) {
  const task = await taskRepository.findRaw(taskId);
  if (!task) throw ApiError.notFound('Task not found');
  const step = findStep(task, stepId);

  if (status === STEP_STATUS.DONE && step.requiresApproval && step.approvalStatus !== APPROVAL_STATUS.APPROVED) {
    // Marking "done" on an approval-gated step just requests approval —
    // it doesn't count as complete until a lead signs off.
    step.status = STEP_STATUS.IN_PROGRESS;
    step.approvalStatus = APPROVAL_STATUS.PENDING;
  } else {
    step.status = status;
    if (status === STEP_STATUS.DONE) {
      step.completedBy = actingEmployeeId;
      step.completedAt = new Date();
    } else {
      step.completedBy = undefined;
      step.completedAt = undefined;
    }
  }

  task.status = deriveTaskStatus(task.status, task.steps);
  await task.save();

  if (task.status === TASK_STATUS.DONE) {
    await clientActivity.log(task.client, 'TASK_COMPLETED', { itemLabel: task.itemLabel, sectionName: task.sectionName });
  }
  return taskRepository.findById(taskId);
}

async function decideStepApproval(taskId, stepId, approved, approverEmployeeId) {
  const task = await taskRepository.findRaw(taskId);
  if (!task) throw ApiError.notFound('Task not found');
  const step = findStep(task, stepId);
  if (!step.requiresApproval) throw ApiError.badRequest('This step does not require approval');

  step.approvalStatus = approved ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.REJECTED;
  step.approvedBy = approverEmployeeId;
  step.approvedAt = new Date();
  step.status = approved ? STEP_STATUS.DONE : STEP_STATUS.IN_PROGRESS;
  if (approved) {
    step.completedBy = approverEmployeeId;
    step.completedAt = new Date();
  }

  task.status = deriveTaskStatus(task.status, task.steps);
  await task.save();
  return taskRepository.findById(taskId);
}

async function addAttachment(taskId, { label, url }, employeeId) {
  const task = await taskRepository.findRaw(taskId);
  if (!task) throw ApiError.notFound('Task not found');
  task.attachments.push({ label, url, addedBy: employeeId, addedAt: new Date() });
  await task.save();
  return taskRepository.findById(taskId);
}

async function removeAttachment(taskId, attachmentIndex) {
  const task = await taskRepository.findRaw(taskId);
  if (!task) throw ApiError.notFound('Task not found');
  task.attachments.splice(attachmentIndex, 1);
  await task.save();
  return taskRepository.findById(taskId);
}

// Carries a missed task forward into the client's current cycle — a fresh
// Task with the same steps reset to their initial state, linked both ways
// to the original for a visible trail.
async function rolloverTask(taskId) {
  const original = await taskRepository.findRaw(taskId);
  if (!original) throw ApiError.notFound('Task not found');
  if (original.status !== TASK_STATUS.MISSED) throw ApiError.badRequest('Only a missed task can be rolled over');

  const client = await clientRepository.findById(original.client);
  if (!client) throw ApiError.notFound('Client not found');
  const currentCycle = await taskCycleService.ensureCurrentCycle(client);

  const newTask = await taskRepository.create({
    client: original.client,
    cycle: currentCycle._id,
    quotationTemplate: original.quotationTemplate,
    sectionName: original.sectionName,
    itemLabel: original.itemLabel,
    itemIndex: original.itemIndex,
    steps: original.steps.map((s) => ({ label: s.label, order: s.order, requiresApproval: s.requiresApproval })),
    assignedTeam: original.assignedTeam,
    assignedEmployees: original.assignedEmployees,
    leadEmployee: original.leadEmployee,
    rolledOverFrom: original._id,
  });

  original.status = TASK_STATUS.ROLLED_OVER;
  original.rolledOverTo = newTask._id;
  await original.save();

  await clientActivity.log(original.client, 'TASK_ROLLED_OVER', { itemLabel: original.itemLabel, sectionName: original.sectionName });
  return taskRepository.findById(newTask._id);
}

// Daily sweep: any step past its due date, not done, not already notified
// about — notify its assignees once and stamp the guard.
async function sweepOverdueSteps() {
  const today = new Date();
  const tasks = await Task.find({
    isDeleted: false,
    status: { $nin: [TASK_STATUS.DONE, TASK_STATUS.MISSED, TASK_STATUS.ROLLED_OVER] },
    'steps.dueDate': { $lt: today },
  });

  let notified = 0;
  for (const task of tasks) {
    // eslint-disable-next-line no-await-in-loop
    const client = await clientRepository.findById(task.client);
    if (!client) continue;

    let changed = false;
    for (const step of task.steps) {
      if (step.dueDate && step.dueDate < today && step.status !== STEP_STATUS.DONE && !step.overdueNotifiedAt) {
        // eslint-disable-next-line no-await-in-loop
        await taskNotify.notifyStepOverdue(task, client, step);
        step.overdueNotifiedAt = new Date();
        changed = true;
        notified += 1;
      }
    }
    if (changed) {
      // eslint-disable-next-line no-await-in-loop
      await task.save();
    }
  }
  return { stepsNotified: notified };
}

async function listMessages(taskId) {
  return taskMessageRepository.listForTask(taskId);
}

async function postMessage(taskId, senderEmployeeId, body) {
  return taskMessageRepository.create({ task: taskId, sender: senderEmployeeId, body });
}

// Cross-client aggregate views — dashboard, workload, content calendar.
async function listByAssignee(employeeId) {
  return taskRepository.listByAssignee(employeeId);
}

async function listByClientsInWindow(clientIds, from, to) {
  return taskRepository.listByClientsInWindow(clientIds, from, to);
}

module.exports = {
  getTask,
  listForClient,
  updateAssignment,
  updateStepAssignment,
  updateStepStatus,
  decideStepApproval,
  addAttachment,
  removeAttachment,
  rolloverTask,
  sweepOverdueSteps,
  listMessages,
  postMessage,
  listByAssignee,
  listByClientsInWindow,
};
