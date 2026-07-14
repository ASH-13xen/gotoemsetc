const TaskCycle = require('../models/TaskCycle');

function create(data) {
  return TaskCycle.create(data);
}

function findCurrentForClient(clientId, today = new Date()) {
  return TaskCycle.findOne({ client: clientId, startDate: { $lte: today }, endDate: { $gte: today } });
}

function findLatestForClient(clientId) {
  return TaskCycle.findOne({ client: clientId }).sort({ cycleNumber: -1 });
}

function listForClient(clientId) {
  return TaskCycle.find({ client: clientId }).sort({ cycleNumber: -1 });
}

function findById(id) {
  return TaskCycle.findById(id);
}

// Cycles that have ended but haven't been swept for missed tasks yet —
// what the daily job processes for rollover-marking.
function listUnclosedEnded(today = new Date()) {
  return TaskCycle.find({ endDate: { $lt: today }, closedAt: null });
}

// Cycles that are still open, ending within the reminder window, and
// haven't already had a reminder sent — what the daily job processes for
// "X remaining, cycle ends in N days" notifications.
function listDueForReminder(reminderThresholdDate, today = new Date()) {
  return TaskCycle.find({
    startDate: { $lte: today },
    endDate: { $gte: today, $lte: reminderThresholdDate },
    reminderSentAt: null,
  });
}

function markGenerated(id) {
  return TaskCycle.findByIdAndUpdate(id, { tasksGeneratedAt: new Date() });
}

function markReminderSent(id) {
  return TaskCycle.findByIdAndUpdate(id, { reminderSentAt: new Date() });
}

function markClosed(id) {
  return TaskCycle.findByIdAndUpdate(id, { closedAt: new Date() });
}

module.exports = {
  create,
  findCurrentForClient,
  findLatestForClient,
  listForClient,
  findById,
  listUnclosedEnded,
  listDueForReminder,
  markGenerated,
  markReminderSent,
  markClosed,
};
