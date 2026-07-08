const ApiError = require('../utils/ApiError');
const pipelineLogRepository = require('../repositories/pipelineLog.repository');
const { TASK_STAGE } = require('../config/constants');

const FIXED_STAGES = Object.values(TASK_STAGE).filter((s) => s !== TASK_STAGE.CUSTOM);

function toEntryView(entry) {
  const loggedByUser = entry.loggedBy;
  const employee = loggedByUser?.employeeLink;
  const loggedByName = employee
    ? `${employee.firstName} ${employee.lastName || ''}`.trim()
    : loggedByUser?.username;

  return {
    _id: entry._id,
    stage: entry.stage,
    customLabel: entry.customLabel,
    note: entry.note,
    sourceTask: entry.sourceTask,
    taskDate: entry.taskDate,
    loggedByName,
    createdAt: entry.createdAt,
  };
}

// Groups the client's log entries into the 7 fixed stage rows plus an
// "Others" bucket further grouped by each distinct custom label.
async function listForClient(clientId) {
  const entries = await pipelineLogRepository.listByClient(clientId);

  const stages = Object.fromEntries(FIXED_STAGES.map((s) => [s, []]));
  const othersByLabel = new Map();

  for (const entry of entries) {
    const view = toEntryView(entry);
    if (entry.stage === TASK_STAGE.CUSTOM) {
      const label = entry.customLabel || 'Uncategorized';
      if (!othersByLabel.has(label)) othersByLabel.set(label, []);
      othersByLabel.get(label).push(view);
    } else {
      stages[entry.stage].push(view);
    }
  }

  const others = [...othersByLabel.entries()].map(([label, logEntries]) => ({ label, entries: logEntries }));

  return { stages, others };
}

async function createManualEntry({ client, stage, customLabel, note }, loggedById) {
  if (stage === TASK_STAGE.CUSTOM && !customLabel) {
    throw ApiError.badRequest('customLabel is required when stage is custom');
  }
  const entry = await pipelineLogRepository.create({ client, stage, customLabel, note, loggedBy: loggedById });
  return entry;
}

module.exports = { listForClient, createManualEntry };
