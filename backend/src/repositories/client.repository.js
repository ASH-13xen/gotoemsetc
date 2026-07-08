const Client = require('../models/Client');

const POPULATE_TEAM = {
  path: 'assignedTeam',
  select: 'name leader',
  populate: { path: 'leader', select: 'firstName lastName' },
};

function listQuery({ search, status }) {
  const query = { isDeleted: false };
  if (status) query.status = status;
  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [{ clientName: regex }, { brandName: regex }];
  }
  return query;
}

async function list({ search, status, page = 1, limit = 20 }) {
  const query = listQuery({ search, status });
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Client.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE_TEAM),
    Client.countDocuments(query),
  ]);

  return { items, total, page, limit };
}

function findById(id) {
  return Client.findOne({ _id: id, isDeleted: false }).populate(POPULATE_TEAM);
}

function create(data) {
  return Client.create(data);
}

function updateById(id, data) {
  return Client.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    returnDocument: 'after',
    runValidators: true,
  }).populate(POPULATE_TEAM);
}

function addContact(id, contact) {
  return Client.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $push: { contacts: contact } },
    { returnDocument: 'after', runValidators: true }
  );
}

function removeContact(id, contactId) {
  return Client.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $pull: { contacts: { _id: contactId } } },
    { returnDocument: 'after' }
  );
}

function softDeleteById(id) {
  return Client.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { returnDocument: 'after' }
  );
}

module.exports = { list, findById, create, updateById, addContact, removeContact, softDeleteById };
