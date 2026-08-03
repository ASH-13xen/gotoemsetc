const WorkTeam = require('../models/WorkTeam');

const POPULATE_FIELDS = 'firstName lastName designation';

function list() {
  return WorkTeam.find({ isDeleted: false })
    .sort({ name: 1 })
    .populate('leader', POPULATE_FIELDS)
    .populate('members', POPULATE_FIELDS);
}

function findById(id) {
  return WorkTeam.findOne({ _id: id, isDeleted: false })
    .populate('leader', POPULATE_FIELDS)
    .populate('members', POPULATE_FIELDS);
}

function create(data) {
  return WorkTeam.create(data);
}

function updateById(id, data) {
  return WorkTeam.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  })
    .populate('leader', POPULATE_FIELDS)
    .populate('members', POPULATE_FIELDS);
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

module.exports = { list, findById, create, updateById, softDeleteById, isLeaderOfMember };
