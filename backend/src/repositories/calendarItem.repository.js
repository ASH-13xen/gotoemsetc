const CalendarItem = require('../models/CalendarItem');

const EMPLOYEE_FIELDS = 'firstName lastName designation';

// Subtasks are populated with just enough to derive live status on the
// calendar without a second round trip — the item deliberately doesn't mirror
// task status, so this join is how the calendar stays truthful when someone
// completes work directly in Task Management.
const TASK_SELECT = 'title status endAt completionFlag assignedEmployees parentTask isDeleted';

const POPULATE = [
  { path: 'assignments.designer', select: EMPLOYEE_FIELDS },
  { path: 'assignments.shooter', select: EMPLOYEE_FIELDS },
  { path: 'assignments.editor', select: EMPLOYEE_FIELDS },
  { path: 'task', select: TASK_SELECT },
  { path: 'subtaskRefs.design', select: TASK_SELECT },
  { path: 'subtaskRefs.shoot', select: TASK_SELECT },
  { path: 'subtaskRefs.edit', select: TASK_SELECT },
  { path: 'publishedBy', select: EMPLOYEE_FIELDS },
];

function findById(id) {
  return CalendarItem.findOne({ _id: id, isDeleted: false }).populate(POPULATE);
}

function listForCalendar(calendarId) {
  return CalendarItem.find({ calendar: calendarId, isDeleted: false })
    .sort({ scheduledDate: 1, type: 1, index: 1 })
    .populate(POPULATE);
}

// Highest index already used for this type in this calendar. Soft-deleted
// items are counted so numbers are never reused — deleting POST #2 leaves a
// gap rather than renumbering #3 down onto a label people have already
// discussed.
async function nextIndexForType(calendarId, type) {
  const last = await CalendarItem.findOne({ calendar: calendarId, type }).sort({ index: -1 }).select('index');
  return (last?.index || 0) + 1;
}

function countsByType(calendarId) {
  return CalendarItem.aggregate([
    { $match: { calendar: calendarId, isDeleted: false } },
    {
      $group: {
        _id: '$type',
        scheduled: { $sum: 1 },
        published: { $sum: { $cond: [{ $ne: ['$publishedAt', null] }, 1, 0] } },
      },
    },
  ]);
}

function listByStage(calendarId, stages) {
  return CalendarItem.find({ calendar: calendarId, stage: { $in: stages }, isDeleted: false }).populate(POPULATE);
}

// Items awaiting an approval decision for longer than `since` — backs the
// "stalled approvals" escalation surfaced to admin/sales.
function listStalledApprovals(since, stages) {
  return CalendarItem.find({
    stage: { $in: stages },
    isDeleted: false,
    submittedAt: { $lte: since },
    publishedAt: null,
  }).populate(POPULATE);
}

function findByTaskId(taskId) {
  return CalendarItem.findOne({
    isDeleted: false,
    $or: [
      { task: taskId },
      { 'subtaskRefs.design': taskId },
      { 'subtaskRefs.shoot': taskId },
      { 'subtaskRefs.edit': taskId },
    ],
  }).populate(POPULATE);
}

function create(data) {
  return CalendarItem.create(data);
}

function updateById(id, data) {
  return CalendarItem.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  }).populate(POPULATE);
}

function pushStageHistory(id, entry) {
  return CalendarItem.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $push: { stageHistory: entry } },
    { returnDocument: 'after' }
  );
}

function softDeleteById(id) {
  return CalendarItem.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { returnDocument: 'after' }
  );
}

module.exports = {
  findById,
  listForCalendar,
  nextIndexForType,
  countsByType,
  listByStage,
  listStalledApprovals,
  findByTaskId,
  create,
  updateById,
  pushStageHistory,
  softDeleteById,
};
