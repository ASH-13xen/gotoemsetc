const ClientCalendar = require('../models/ClientCalendar');

const EMPLOYEE_FIELDS = 'firstName lastName designation';

// The team is populated with leader and memberRoles resolved, because every
// pipeline-step decision reads both — see cmsWorkflow.service.js and
// utils/teamRoles.js. `members` has to be populated too, not merely
// selected: the scheduling dialog builds its assignee list from leader +
// members, and unpopulated members arrive as bare ObjectIds with no name to
// render.
const POPULATE = [
  { path: 'client', select: 'name brandName logoUrl currentPlan defaultTeam' },
  {
    path: 'team',
    select: 'name leader members memberRoles',
    populate: [
      { path: 'leader', select: EMPLOYEE_FIELDS },
      { path: 'members', select: EMPLOYEE_FIELDS },
      { path: 'memberRoles.employee', select: EMPLOYEE_FIELDS },
    ],
  },
  { path: 'createdBy', select: EMPLOYEE_FIELDS },
];

function findById(id) {
  return ClientCalendar.findOne({ _id: id, isDeleted: false }).populate(POPULATE);
}

function findForClientMonth(clientId, year, month) {
  return ClientCalendar.findOne({ client: clientId, year, month, isDeleted: false }).populate(POPULATE);
}

function listForClient(clientId) {
  return ClientCalendar.find({ client: clientId, isDeleted: false })
    .sort({ year: -1, month: -1 })
    .populate(POPULATE);
}

// Every calendar for a set of clients — backs the month-end report sweep and
// the "which months exist" pickers.
function listForClientsInMonth(clientIds, year, month) {
  return ClientCalendar.find({ client: { $in: clientIds }, year, month, isDeleted: false }).populate(POPULATE);
}

function create(data) {
  return ClientCalendar.create(data);
}

function updateById(id, data) {
  return ClientCalendar.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  }).populate(POPULATE);
}

function softDeleteById(id) {
  return ClientCalendar.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { returnDocument: 'after' }
  );
}

// Open (unclosed) calendars for a given month — the close-month job's queue.
function listOpenForMonth(year, month) {
  return ClientCalendar.find({ year, month, isDeleted: false, closedAt: null }).populate(POPULATE);
}

module.exports = {
  findById,
  findForClientMonth,
  listForClient,
  listForClientsInMonth,
  create,
  updateById,
  softDeleteById,
  listOpenForMonth,
};
