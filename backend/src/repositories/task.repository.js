const mongoose = require('mongoose');
const Task = require('../models/Task');

const POPULATE_ASSIGNEES = [
  { path: 'client', select: 'clientName brandName' },
  { path: 'assigneeEmployees', select: 'firstName lastName designation employeeCode' },
  { path: 'assigneeTeam', select: 'name leader members' },
  { path: 'comments.author', select: 'username role employeeLink' },
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

// One soonest non-done, due-dated task per client — powers the Clients list's
// "task if any due, priority and due date" summary.
async function findNextDueForClients(clientIds) {
  return Task.aggregate([
    {
      $match: {
        isDeleted: false,
        client: { $in: clientIds.map((id) => new mongoose.Types.ObjectId(id)) },
        status: { $ne: 'done' },
        dueDate: { $ne: null },
      },
    },
    { $sort: { dueDate: 1 } },
    {
      $group: {
        _id: '$client',
        title: { $first: '$title' },
        priority: { $first: '$priority' },
        dueDate: { $first: '$dueDate' },
      },
    },
  ]);
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
  findNextDueForClients,
  pushComment,
  pushAttachment,
  pullAttachment,
};
