const ApiError = require('../utils/ApiError');
const { TASK_STAGE, TASK_STATUS } = require('../config/constants');
const taskRepository = require('../repositories/task.repository');
const cloudinaryUpload = require('../services/cloudinaryUpload.service');

const PARALLEL_STAGES = [TASK_STAGE.POST_CREATION, TASK_STAGE.SHOOT, TASK_STAGE.EDIT_DESIGN];

async function listTasks(params) {
  return taskRepository.list(params);
}

async function getTask(id) {
  const task = await taskRepository.findById(id);
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

async function createTask(data, createdBy) {
  return taskRepository.create({ ...data, createdBy });
}

async function updateTask(id, data) {
  const task = await taskRepository.updateById(id, data);
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

async function deleteTask(id) {
  const task = await taskRepository.softDeleteById(id);
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

// Drives the fixed client pipeline: Plan of Action -> (Post / Shoot / Edit-
// Design in parallel) -> Calendar (unlocked only once all three are done) ->
// Report. Internal/ad-hoc tasks (no client, or stage CUSTOM) never trigger this.
async function maybeAdvancePipeline(task) {
  if (!task.client || task.stage === TASK_STAGE.CUSTOM) return;

  if (task.stage === TASK_STAGE.PLAN_OF_ACTION) {
    const siblings = await Promise.all(
      PARALLEL_STAGES.map((stage) =>
        taskRepository.create({
          title: `${stage.replace('_', ' ')} — cycle ${task.cycle}`,
          client: task.client,
          stage,
          cycle: task.cycle,
          status: TASK_STATUS.TODO,
        })
      )
    );
    await taskRepository.create({
      title: `Calendar — cycle ${task.cycle}`,
      client: task.client,
      stage: TASK_STAGE.CALENDAR,
      cycle: task.cycle,
      status: TASK_STATUS.BLOCKED,
      autoUnlock: true,
      dependsOn: siblings.map((s) => s._id),
    });
    return;
  }

  if (PARALLEL_STAGES.includes(task.stage)) {
    const siblings = await taskRepository.findSiblings({
      client: task.client,
      cycle: task.cycle,
      stages: PARALLEL_STAGES,
    });
    const allDone = siblings.length === PARALLEL_STAGES.length && siblings.every((s) => s.status === TASK_STATUS.DONE);
    if (!allDone) return;

    const calendarTask = await taskRepository.findOneByClientCycleStage({
      client: task.client,
      cycle: task.cycle,
      stage: TASK_STAGE.CALENDAR,
    });
    if (calendarTask && calendarTask.status === TASK_STATUS.BLOCKED) {
      await taskRepository.updateById(calendarTask._id, { status: TASK_STATUS.TODO });
    }
    return;
  }

  if (task.stage === TASK_STAGE.CALENDAR) {
    await taskRepository.create({
      title: `Report — cycle ${task.cycle}`,
      client: task.client,
      stage: TASK_STAGE.REPORT,
      cycle: task.cycle,
      status: TASK_STATUS.TODO,
    });
  }

  // stage === REPORT: cycle complete. Auto-starting the next cycle is a
  // backlog item, not built now.
}

async function updateStatus(id, status) {
  const task = await taskRepository.updateById(id, { status });
  if (!task) throw ApiError.notFound('Task not found');
  if (status === TASK_STATUS.DONE) {
    await maybeAdvancePipeline(task);
  }
  return task;
}

async function startPipelineCycle(clientId) {
  const cycle = await taskRepository.nextCycleNumber(clientId);
  return taskRepository.create({
    title: `Plan of Action — cycle ${cycle}`,
    client: clientId,
    stage: TASK_STAGE.PLAN_OF_ACTION,
    cycle,
    status: TASK_STATUS.TODO,
  });
}

async function addComment(id, author, body) {
  const task = await taskRepository.pushComment(id, { author, body });
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

async function addAttachment(id, file, uploadedBy) {
  const publicId = `tasks/${id}/${Date.now()}${cloudinaryUpload.extensionFor(file.originalname, file.mimetype)}`;
  const result = await cloudinaryUpload.uploadBuffer(file.buffer, { folder: 'tasks', publicId, resourceType: 'raw' });
  const task = await taskRepository.pushAttachment(id, {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    uploadedBy,
  });
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

async function removeAttachment(id, attachmentId) {
  const existing = await taskRepository.findById(id);
  if (!existing) throw ApiError.notFound('Task not found');
  const attachment = existing.attachments.id(attachmentId);
  if (attachment) {
    await cloudinaryUpload.destroy(attachment.publicId, { resourceType: attachment.resourceType });
  }
  return taskRepository.pullAttachment(id, attachmentId);
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  updateStatus,
  startPipelineCycle,
  addComment,
  addAttachment,
  removeAttachment,
};
