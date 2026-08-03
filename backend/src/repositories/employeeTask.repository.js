const EmployeeTask = require('../models/EmployeeTask');
const WorkTeam = require('../models/WorkTeam');
const Employee = require('../models/Employee');
const { EMPLOYEE_TASK_STATUS, EMPLOYEE_TASK_TYPE } = require('../config/constants');

const EMPLOYEE_FIELDS = 'firstName lastName designation';

// assignedEmployees needs `manager` populated one level deeper — that's
// what taskAccess.js#isPersonalManager checks against for Personal tasks.
function basePopulate(query) {
  return query
    .populate({
      path: 'assignedEmployees',
      select: `${EMPLOYEE_FIELDS} manager`,
      populate: { path: 'manager', select: EMPLOYEE_FIELDS },
    })
    .populate({
      path: 'team',
      select: 'name leader members',
      populate: [
        { path: 'leader', select: EMPLOYEE_FIELDS },
        { path: 'members', select: EMPLOYEE_FIELDS },
      ],
    })
    .populate('extraMembers', EMPLOYEE_FIELDS)
    .populate('client', 'name logoUrl')
    .populate('event', 'name description')
    .populate('markedForReviewBy', EMPLOYEE_FIELDS)
    .populate('completedBy', EMPLOYEE_FIELDS)
    .populate('createdBy', EMPLOYEE_FIELDS)
    .populate('continuesFrom', 'title status completedAt createdAt');
}

// Scoped to isDeleted:false — for normal reads.
function findById(id) {
  return basePopulate(EmployeeTask.findOne({ _id: id, isDeleted: false }));
}

// Unscoped — used by taskAccess.middleware.js, which needs to 404 (not
// silently no-op) on an id that only exists soft-deleted.
function findRaw(id) {
  return basePopulate(EmployeeTask.findById(id));
}

function create(data) {
  return EmployeeTask.create(data);
}

function updateById(id, data) {
  return basePopulate(
    EmployeeTask.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
      returnDocument: 'after',
      runValidators: true,
    })
  );
}

function softDeleteById(id) {
  return EmployeeTask.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { returnDocument: 'after' });
}

function addFollowUp(taskId, followUp) {
  return basePopulate(
    EmployeeTask.findOneAndUpdate(
      { _id: taskId, isDeleted: false },
      { $push: { followUps: followUp } },
      { returnDocument: 'after', runValidators: true }
    )
  );
}

// Array-subdocument updates go through the plain document API (no atomic
// positional-update shorthand covers "set several fields on the matched
// subdoc" cleanly) — findOne, mutate the subdoc in place, save, re-fetch
// populated for the response.
async function updateFollowUpById(taskId, followUpId, data) {
  const task = await EmployeeTask.findOne({ _id: taskId, isDeleted: false });
  if (!task) return null;
  const followUp = task.followUps.id(followUpId);
  if (!followUp) return null;
  Object.assign(followUp, data);
  await task.save();
  return findById(taskId);
}

function listSubtasks(parentId) {
  return basePopulate(EmployeeTask.find({ parentTask: parentId, isDeleted: false }).sort({ startAt: 1 }));
}

// Walks a continuation chain: back to the root via continuesFrom, then
// forward collecting every link, newest first. Chains are expected to stay
// short (a handful of reassignments), so the per-hop query cost here is a
// non-issue in practice.
async function findChain(taskId) {
  let rootId = taskId;
  let cursor = await EmployeeTask.findOne({ _id: rootId, isDeleted: false }, 'continuesFrom').lean();
  if (!cursor) return [];
  while (cursor.continuesFrom) {
    rootId = cursor.continuesFrom;
    cursor = await EmployeeTask.findOne({ _id: rootId, isDeleted: false }, 'continuesFrom').lean();
  }

  const chain = [];
  let node = await basePopulate(EmployeeTask.findOne({ _id: rootId, isDeleted: false }));
  while (node) {
    chain.push(node);
    // eslint-disable-next-line no-await-in-loop
    node = await basePopulate(EmployeeTask.findOne({ continuesFrom: node._id, isDeleted: false }));
  }
  return chain.reverse();
}

// Team ids where this employee is a member or the leader — the "am I on
// this team's roster" scope for /mine and /mine/upcoming.
async function findTeamIdsForEmployee(employeeId) {
  const teams = await WorkTeam.find(
    { isDeleted: false, $or: [{ members: employeeId }, { leader: employeeId }] },
    '_id'
  );
  return teams.map((t) => t._id);
}

async function findLedTeamIds(employeeId) {
  const teams = await WorkTeam.find({ isDeleted: false, leader: employeeId }, '_id');
  return teams.map((t) => t._id);
}

async function findDirectReportIds(employeeId) {
  const reports = await Employee.find({ isDeleted: false, manager: employeeId }, '_id');
  return reports.map((r) => r._id);
}

// Top-level tasks only (parentTask: null) — subtasks are reached via
// listSubtasks from a parent's detail view, not this flat list. A
// subtask's assignees are drawn from its parent's team/extraMembers pool,
// so anyone assigned a subtask is already on the parent's roster and will
// see the parent here regardless.
async function listMine({ employeeId, isAdmin, type }) {
  const query = { isDeleted: false, parentTask: null };
  if (type) query.type = type;

  if (!isAdmin) {
    const teamIds = await findTeamIdsForEmployee(employeeId);
    query.$or = [{ assignedEmployees: employeeId }, { team: { $in: teamIds } }, { extraMembers: employeeId }];
  }

  return basePopulate(EmployeeTask.find(query).sort({ endAt: 1 }));
}

// Dashboard-widget feed — broader than listMine: includes subtasks
// explicitly assigned to this employee, not just top-level tasks.
async function listUpcomingForEmployee(employeeId, { limit = 6 } = {}) {
  const teamIds = await findTeamIdsForEmployee(employeeId);
  const query = {
    isDeleted: false,
    status: { $ne: EMPLOYEE_TASK_STATUS.COMPLETED },
    $or: [
      { assignedEmployees: employeeId },
      { parentTask: null, team: { $in: teamIds } },
      { parentTask: null, extraMembers: employeeId },
    ],
  };
  return basePopulate(EmployeeTask.find(query).sort({ endAt: 1 }).limit(limit));
}

// Who this employee reviews for (direct reports' personal tasks, teams
// they lead) — independent of whether anything's currently pending, so the
// frontend can show the Review tab even when it's momentarily empty.
async function getReviewScope(employeeId) {
  const [reportIds, ledTeamIds] = await Promise.all([findDirectReportIds(employeeId), findLedTeamIds(employeeId)]);
  return { reportIds, ledTeamIds };
}

async function listReviewForScope({ reportIds, ledTeamIds }) {
  if (!reportIds.length && !ledTeamIds.length) return [];
  const query = {
    isDeleted: false,
    status: EMPLOYEE_TASK_STATUS.FOR_REVIEW,
    $or: [
      { type: EMPLOYEE_TASK_TYPE.PERSONAL, assignedEmployees: { $in: reportIds } },
      { team: { $in: ledTeamIds } },
    ],
  };
  return basePopulate(EmployeeTask.find(query).sort({ markedForReviewAt: 1 }));
}

function listAllForReview() {
  return basePopulate(
    EmployeeTask.find({ isDeleted: false, status: EMPLOYEE_TASK_STATUS.FOR_REVIEW }).sort({ markedForReviewAt: 1 })
  );
}

// Admin's "Filter by Employee" — everything this employee actually touches:
// their personal tasks, any subtask explicitly delegated to them (any
// parent type), and any top-level team/client/event task they're currently
// on the roster for (member, leader, or ad-hoc extra member). Unlike
// listMine, this is intentionally not scoped to top-level-only — a subtask
// assigned to them belongs in this view even though its parent might not
// (e.g. they're not on that team, just delegated the one subtask).
async function listForEmployeeAdmin(employeeId) {
  const teamIds = await findTeamIdsForEmployee(employeeId);
  const query = {
    isDeleted: false,
    $or: [
      { assignedEmployees: employeeId },
      { parentTask: null, team: { $in: teamIds } },
      { parentTask: null, extraMembers: employeeId },
    ],
  };
  return basePopulate(EmployeeTask.find(query).sort({ endAt: 1 }));
}

// Admin's "Filter by Team" — every member's (leader included) personal
// tasks, any subtask assigned to a member, and every top-level team/client/
// event task tied to this team (client/event tasks carry a `team` too, so
// the single `team: teamId` clause already covers all three).
async function listForTeamAdmin(teamId) {
  const team = await WorkTeam.findOne({ _id: teamId, isDeleted: false }, 'leader members');
  if (!team) return [];
  const memberIds = [team.leader, ...team.members];

  const query = {
    isDeleted: false,
    $or: [
      { type: EMPLOYEE_TASK_TYPE.PERSONAL, assignedEmployees: { $in: memberIds } },
      { parentTask: { $ne: null }, assignedEmployees: { $in: memberIds } },
      { parentTask: null, team: teamId },
    ],
  };
  return basePopulate(EmployeeTask.find(query).sort({ endAt: 1 }));
}

// Follow-up reminder cron's "what's due" scan — see
// employeeTaskFollowUpReminder.job.js. Only non-deleted tasks; the job
// filters each task's own followUps array down to the due-and-unreminded
// entries itself.
function findWithDueFollowUps(now) {
  return basePopulate(
    EmployeeTask.find({
      isDeleted: false,
      followUps: { $elemMatch: { followUpAt: { $lte: now }, reminderSentAt: null } },
    })
  );
}

module.exports = {
  findById,
  findRaw,
  create,
  updateById,
  softDeleteById,
  addFollowUp,
  updateFollowUpById,
  listSubtasks,
  findChain,
  listMine,
  listUpcomingForEmployee,
  getReviewScope,
  listReviewForScope,
  listAllForReview,
  findWithDueFollowUps,
  listForEmployeeAdmin,
  listForTeamAdmin,
};
