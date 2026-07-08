const PipelineLogEntry = require('../models/PipelineLogEntry');

const POPULATE_LOGGED_BY = {
  path: 'loggedBy',
  select: 'username employeeLink',
  populate: { path: 'employeeLink', select: 'firstName lastName' },
};

function listByClient(clientId) {
  return PipelineLogEntry.find({ client: clientId }).sort({ createdAt: 1 }).populate(POPULATE_LOGGED_BY);
}

function create(data) {
  return PipelineLogEntry.create(data);
}

// Upserts the single auto-copy row for a given task so re-labeling or
// editing a task's title/date updates its existing Pipeline row instead of
// duplicating it.
async function upsertForTask(task, loggedById) {
  const filter = { sourceTask: task._id };
  const update = {
    client: task.client,
    stage: task.stage,
    customLabel: task.stage === 'custom' ? task.customLabel : undefined,
    note: task.title,
    taskDate: task.dueDate,
    loggedBy: loggedById,
  };
  return PipelineLogEntry.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
}

function removeForTask(taskId) {
  return PipelineLogEntry.deleteMany({ sourceTask: taskId });
}

module.exports = { listByClient, create, upsertForTask, removeForTask };
