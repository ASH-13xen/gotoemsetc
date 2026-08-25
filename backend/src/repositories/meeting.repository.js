const Meeting = require('../models/Meeting');
const { MEETING_STATUS } = require('../config/constants');

const EMPLOYEE_FIELDS = 'firstName lastName designation';

const POPULATE = [
  { path: 'client', select: 'name brandName defaultTeam' },
  { path: 'participants', select: EMPLOYEE_FIELDS },
  { path: 'createdBy', select: 'username role' },
  { path: 'cancelledBy', select: 'username role' },
  { path: 'mom.attendeesPresent', select: EMPLOYEE_FIELDS },
  { path: 'mom.attendeesAbsent', select: EMPLOYEE_FIELDS },
  { path: 'mom.writtenBy', select: 'username role' },
  // Live status for the manual/client-detail UI — title/description are
  // read from the snapshot fields instead, which stay accurate even if the
  // live task is later renamed or deleted.
  { path: 'spawnedTasks.task', select: 'title status' },
  { path: 'taskEdits.changedBy', select: 'username role' },
];

function listForClient(clientId) {
  return Meeting.find({ client: clientId, isDeleted: false }).sort({ scheduledAt: -1 }).populate(POPULATE);
}

function findById(id) {
  return Meeting.findOne({ _id: id, isDeleted: false }).populate(POPULATE);
}

function create(data) {
  return Meeting.create(data);
}

function updateById(id, data) {
  return Meeting.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  }).populate(POPULATE);
}

// The 24h-late-MOM cron's "what's due" scan — see jobs/meetingReminder.job.js.
// Populated just enough to resolve notification recipients without a second
// query per meeting.
function findDueForLateMomFlag(cutoff) {
  return Meeting.find({
    isDeleted: false,
    status: { $ne: MEETING_STATUS.CANCELLED },
    mom: { $exists: false },
    scheduledAt: { $lt: cutoff },
    lateFlaggedAt: null,
  }).populate({ path: 'client', select: 'name defaultTeam', populate: { path: 'defaultTeam', select: 'leader members' } });
}

module.exports = { listForClient, findById, create, updateById, findDueForLateMomFlag };
