const TaskClient = require('../models/TaskClient');

const POPULATE = [
  { path: 'defaultTeam', select: 'name leader members' },
  { path: 'teamHistory.team', select: 'name leader members' },
];

function list() {
  return TaskClient.find({ isDeleted: false }).sort({ name: 1 }).populate(POPULATE);
}

function findById(id) {
  return TaskClient.findOne({ _id: id, isDeleted: false }).populate(POPULATE);
}

function create(data) {
  return TaskClient.create(data);
}

function updateById(id, data) {
  return TaskClient.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  }).populate(POPULATE);
}

function softDeleteById(id) {
  return TaskClient.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { returnDocument: 'after' });
}

// Closes whichever teamHistory entry is currently open (there's ever at most
// one), then opens a new one — unless the team is being cleared, in which
// case there's nothing new to open. See TaskClient.js#teamHistoryEntrySchema.
async function recordTeamChange(id, newTeamId, changedByUserId) {
  const now = new Date();
  await TaskClient.updateOne({ _id: id, 'teamHistory.endedAt': null }, { $set: { 'teamHistory.$.endedAt': now } });
  if (newTeamId) {
    await TaskClient.updateOne(
      { _id: id },
      { $push: { teamHistory: { team: newTeamId, startedAt: now, endedAt: null, changedBy: changedByUserId } } }
    );
  }
}

module.exports = { list, findById, create, updateById, softDeleteById, recordTeamChange };
