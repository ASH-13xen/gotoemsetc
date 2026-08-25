const EmployeeTask = require('../models/EmployeeTask');
const WorkTeam = require('../models/WorkTeam');
const Employee = require('../models/Employee');
const { EMPLOYEE_TASK_STATUS, EMPLOYEE_TASK_TYPE } = require('../config/constants');
const { istDayStart } = require('../utils/istDate');

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
      select: 'name leader members memberRoles',
      populate: [
        { path: 'leader', select: EMPLOYEE_FIELDS },
        { path: 'members', select: EMPLOYEE_FIELDS },
        { path: 'memberRoles.employee', select: EMPLOYEE_FIELDS },
      ],
    })
    .populate('extraMembers', EMPLOYEE_FIELDS)
    .populate('client', 'name logoUrl')
    .populate('event', 'name description')
    .populate('markedForReviewBy', EMPLOYEE_FIELDS)
    .populate('completedBy', EMPLOYEE_FIELDS)
    .populate('createdBy', EMPLOYEE_FIELDS)
    .populate('continuesFrom', 'title status completedAt createdAt')
    // Enough for the UI to say "waiting on Shoot — Reel #1" and disable the
    // submit control, without a second request per task.
    .populate('blockedBy', 'title status endAt');
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

// Shared by the two Plan Next Day queries below: "overdue" is genuinely in
// the past relative to `now` (already breached, whether that was yesterday
// or earlier today), "tomorrow" is anything due somewhere in tomorrow's IST
// civil day — a task still due later *today* falls in neither bucket, since
// it's not late yet and isn't tomorrow's work.
async function splitOverdueAndTomorrow(scopeQuery, now) {
  const todayStart = istDayStart(now);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000);
  const baseQuery = { isDeleted: false, status: { $ne: EMPLOYEE_TASK_STATUS.COMPLETED }, ...scopeQuery };

  const [overdue, tomorrow] = await Promise.all([
    basePopulate(EmployeeTask.find({ ...baseQuery, endAt: { $lt: now } }).sort({ endAt: 1 })),
    basePopulate(
      EmployeeTask.find({ ...baseQuery, endAt: { $gte: tomorrowStart, $lt: tomorrowEnd } }).sort({ endAt: 1 })
    ),
  ]);
  return { overdue, tomorrow };
}

// Plan Next Day — an employee's own overdue-and-tomorrow tasks, same $or
// shape as listUpcomingForEmployee (assignedEmployees directly, or a
// top-level team/client/event task on a team they're on).
async function listDueTomorrowAndOverdueForEmployee(employeeId, now = new Date()) {
  const teamIds = await findTeamIdsForEmployee(employeeId);
  return splitOverdueAndTomorrow(
    {
      $or: [
        { assignedEmployees: employeeId },
        { parentTask: null, team: { $in: teamIds } },
        { parentTask: null, extraMembers: employeeId },
      ],
    },
    now
  );
}

// Plan Next Day, team-wide view for a Team Main/Team Leader reviewing their
// whole team's board rather than just their own tasks.
function listDueTomorrowAndOverdueForTeam(teamId, now = new Date()) {
  return splitOverdueAndTomorrow({ parentTask: null, team: teamId }, now);
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

// Admin unified task view — client/team/employee/date, any combination at
// once (AND across whichever filters are active). Each active filter
// contributes its own clause to a top-level $and; employee and team each
// still expand to the same OR-of-conditions their standalone filters always
// did (a subtask delegated to someone not otherwise on that team/roster
// still has to match), so combining two filters narrows rather than losing
// results either alone would have included.
async function listForAdminFiltered({ clientId, teamId, employeeId, dateFrom, dateTo }) {
  const and = [{ isDeleted: false }];

  if (employeeId) {
    const teamIds = await findTeamIdsForEmployee(employeeId);
    and.push({
      $or: [
        { assignedEmployees: employeeId },
        { parentTask: null, team: { $in: teamIds } },
        { parentTask: null, extraMembers: employeeId },
      ],
    });
  }

  if (teamId) {
    const team = await WorkTeam.findOne({ _id: teamId, isDeleted: false }, 'leader members');
    if (!team) return [];
    const memberIds = [team.leader, ...team.members];
    and.push({
      $or: [
        { type: EMPLOYEE_TASK_TYPE.PERSONAL, assignedEmployees: { $in: memberIds } },
        { parentTask: { $ne: null }, assignedEmployees: { $in: memberIds } },
        { parentTask: null, team: teamId },
      ],
    });
  }

  if (clientId) {
    and.push({ client: clientId });
  }

  // Overlap, not containment — a task spanning the whole month should still
  // match a filter for one week inside it.
  if (dateFrom || dateTo) {
    and.push({
      ...(dateFrom ? { endAt: { $gte: new Date(dateFrom) } } : {}),
      ...(dateTo ? { startAt: { $lte: new Date(dateTo) } } : {}),
    });
  }

  const query = and.length > 1 ? { $and: and } : and[0];
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
  listDueTomorrowAndOverdueForEmployee,
  listDueTomorrowAndOverdueForTeam,
  findLedTeamIds,
  getReviewScope,
  listReviewForScope,
  listAllForReview,
  findWithDueFollowUps,
  listForAdminFiltered,
};
