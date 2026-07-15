const Task = require('../models/Task');

const POPULATE = [
  { path: 'assignedEmployees', select: 'firstName lastName designation employeeCode' },
  { path: 'leadEmployee', select: 'firstName lastName designation employeeCode' },
  { path: 'assignedTeam', select: 'name leader' },
  { path: 'steps.assignedEmployees', select: 'firstName lastName designation employeeCode' },
];

function create(data) {
  return Task.create(data);
}

function insertMany(docs) {
  return Task.insertMany(docs);
}

function findById(id) {
  return Task.findOne({ _id: id, isDeleted: false }).populate(POPULATE);
}

// Sorted by itemIndex (generation order), not itemLabel — itemLabel is a
// string like "Stories #10", and string-sorting that would put "#10" before
// "#2" (lexicographic, not numeric).
function listForCycle(clientId, cycleId) {
  return Task.find({ client: clientId, cycle: cycleId, isDeleted: false }).sort({ sectionName: 1, itemIndex: 1 }).populate(POPULATE);
}

function listForClient(clientId) {
  return Task.find({ client: clientId, isDeleted: false }).sort({ createdAt: -1 }).populate(POPULATE);
}

// For a set of clients, in a date window — the content calendar and
// dashboard's "due this week" both need this shape.
function listByClientsInWindow(clientIds, from, to) {
  return Task.find({
    client: { $in: clientIds },
    isDeleted: false,
    'steps.dueDate': { $gte: from, $lte: to },
  })
    .populate(POPULATE)
    .populate('client', 'clientName brandName logoUrl');
}

function listByAssignee(employeeId) {
  return Task.find({
    isDeleted: false,
    $or: [{ assignedEmployees: employeeId }, { leadEmployee: employeeId }, { 'steps.assignedEmployees': employeeId }],
  })
    .populate(POPULATE)
    .populate('client', 'clientName brandName logoUrl');
}

function listIncompleteForCycle(cycleId) {
  return Task.find({ cycle: cycleId, isDeleted: false, status: { $nin: ['done', 'missed', 'rolled_over'] } });
}

function updateById(id, data) {
  return Task.findOneAndUpdate({ _id: id, isDeleted: false }, data, { returnDocument: 'after', runValidators: true }).populate(
    POPULATE
  );
}

function findRaw(id) {
  return Task.findById(id);
}

// Admin-facing workload overview — active (not done/missed/rolled_over)
// task counts grouped by employee, across every client at once.
async function countActiveByEmployee() {
  return Task.aggregate([
    { $match: { isDeleted: false, status: { $in: ['pending', 'in_progress'] } } },
    { $unwind: '$assignedEmployees' },
    { $group: { _id: '$assignedEmployees', count: { $sum: 1 } } },
  ]);
}

function listActiveForClients(clientIds) {
  return Task.find({ client: { $in: clientIds }, isDeleted: false }).populate(POPULATE).populate('client', 'clientName brandName logoUrl');
}

module.exports = {
  create,
  insertMany,
  findById,
  findRaw,
  listForCycle,
  listForClient,
  listByClientsInWindow,
  listByAssignee,
  listIncompleteForCycle,
  listActiveForClients,
  countActiveByEmployee,
  updateById,
};
