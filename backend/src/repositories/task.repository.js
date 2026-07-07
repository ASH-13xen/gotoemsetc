const Task = require('../models/Task');

const POPULATE_ASSIGNEES = [
  { path: 'client', select: 'clientName brandName' },
  { path: 'assigneeEmployees', select: 'firstName lastName designation employeeCode' },
  { path: 'assigneeTeam', select: 'name members' },
  { path: 'comments.author', select: 'username role' },
];

function listQuery({ client, stage, status, assignee, priority, search }) {
  const query = { isDeleted: false };
  if (client) query.client = client;
  if (stage) query.stage = stage;
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (assignee) query.assigneeEmployees = assignee;
  if (search) query.title = new RegExp(search.trim(), 'i');
  return query;
}

async function list({ client, stage, status, assignee, priority, search, page = 1, limit = 50 }) {
  const query = listQuery({ client, stage, status, assignee, priority, search });
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Task.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE_ASSIGNEES),
    Task.countDocuments(query),
  ]);

  return { items, total, page, limit };
}

function findById(id) {
  return Task.findOne({ _id: id, isDeleted: false }).populate(POPULATE_ASSIGNEES);
}

function create(data) {
  return Task.create(data);
}

function updateById(id, data) {
  return Task.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  }).populate(POPULATE_ASSIGNEES);
}

function softDeleteById(id) {
  return Task.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { returnDocument: 'after' });
}

function findSiblings({ client, cycle, stages }) {
  return Task.find({ client, cycle, stage: { $in: stages }, isDeleted: false });
}

function findOneByClientCycleStage({ client, cycle, stage }) {
  return Task.findOne({ client, cycle, stage, isDeleted: false });
}

function findOverdue(limit = 20) {
  return Task.find({ isDeleted: false, status: { $ne: 'done' }, dueDate: { $lt: new Date() } })
    .sort({ dueDate: 1 })
    .limit(limit)
    .populate('client', 'clientName brandName')
    .populate('assigneeEmployees', 'firstName lastName');
}

function countByClientStage() {
  return Task.aggregate([
    { $match: { isDeleted: false, client: { $ne: null }, stage: { $ne: 'custom' } } },
    { $sort: { cycle: -1, createdAt: -1 } },
    { $group: { _id: '$client', latestStage: { $first: '$stage' }, latestStatus: { $first: '$status' } } },
    {
      $lookup: {
        from: 'clients',
        localField: '_id',
        foreignField: '_id',
        as: 'client',
      },
    },
    { $unwind: '$client' },
    {
      $project: {
        _id: 1,
        latestStage: 1,
        latestStatus: 1,
        clientName: '$client.clientName',
        brandName: '$client.brandName',
      },
    },
  ]);
}

async function nextCycleNumber(client) {
  const latest = await Task.findOne({ client, isDeleted: false }).sort({ cycle: -1 }).select('cycle');
  return latest ? latest.cycle + 1 : 1;
}

function pushComment(id, comment) {
  return Task.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $push: { comments: comment } },
    { returnDocument: 'after', runValidators: true }
  ).populate(POPULATE_ASSIGNEES);
}

function pushAttachment(id, attachment) {
  return Task.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $push: { attachments: attachment } },
    { returnDocument: 'after', runValidators: true }
  ).populate(POPULATE_ASSIGNEES);
}

function pullAttachment(id, attachmentId) {
  return Task.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $pull: { attachments: { _id: attachmentId } } },
    { returnDocument: 'after' }
  ).populate(POPULATE_ASSIGNEES);
}

module.exports = {
  list,
  findById,
  create,
  updateById,
  softDeleteById,
  findSiblings,
  findOneByClientCycleStage,
  nextCycleNumber,
  pushComment,
  pushAttachment,
  pullAttachment,
  findOverdue,
  countByClientStage,
};
