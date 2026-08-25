const WorkTeam = require('../models/WorkTeam');
const { TEAM_MEMBER_ROLE } = require('../config/constants');

const POPULATE_FIELDS = 'firstName lastName designation';

function withPopulation(query) {
  return query
    .populate('leader', POPULATE_FIELDS)
    .populate('members', POPULATE_FIELDS)
    .populate('memberRoles.employee', POPULATE_FIELDS);
}

function list() {
  return withPopulation(WorkTeam.find({ isDeleted: false, isTemporary: { $ne: true } }).sort({ name: 1 }));
}

function findById(id) {
  return withPopulation(WorkTeam.findOne({ _id: id, isDeleted: false }));
}

function create(data) {
  return WorkTeam.create(data);
}

function updateById(id, data) {
  return withPopulation(
    WorkTeam.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
      returnDocument: 'after',
      runValidators: true,
    })
  );
}

function softDeleteById(id) {
  return WorkTeam.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { returnDocument: 'after' });
}

// Does this leader lead a team that memberEmployeeId belongs to (as a
// member OR as the leader themself, i.e. self-assignment)? Backs a team
// leader's authority to create a Personal task for someone on their own
// team — see taskAccess.middleware.js#requireCanCreateTopLevelTask.
function isLeaderOfMember(leaderEmployeeId, memberEmployeeId) {
  return WorkTeam.exists({
    isDeleted: false,
    leader: leaderEmployeeId,
    $or: [{ members: memberEmployeeId }, { leader: memberEmployeeId }],
  });
}

// Every team this employee belongs to, as a member OR as the leader — the
// leader is deliberately never duplicated into `members` (see
// workTeam.service.js), so both have to be matched. Backs the event
// dashboard widget's "responsibilities assigned to me via a team" lookup.
function listForMember(employeeId) {
  return WorkTeam.find({
    isDeleted: false,
    $or: [{ members: employeeId }, { leader: employeeId }],
  });
}

// Every team where this employee is tagged Content Manager — backs the CM's
// "pending my review" leave-approval queue (see
// attendanceRequest.service.js#listPendingForContentManager). Unpopulated,
// same as listForMember — callers only need members/leader ids from these.
function listWhereEmployeeIsContentManager(employeeId) {
  return WorkTeam.find({
    isDeleted: false,
    memberRoles: { $elemMatch: { employee: employeeId, roles: TEAM_MEMBER_ROLE.CONTENT_MANAGER } },
  });
}

module.exports = {
  list,
  findById,
  create,
  updateById,
  softDeleteById,
  isLeaderOfMember,
  listForMember,
  listWhereEmployeeIsContentManager,
};
