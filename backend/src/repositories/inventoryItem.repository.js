const InventoryItem = require('../models/InventoryItem');

const POPULATE = { path: 'category', select: 'name' };

function list() {
  return InventoryItem.find({ isDeleted: false }).sort({ name: 1 }).populate(POPULATE);
}

function findById(id) {
  return InventoryItem.findOne({ _id: id, isDeleted: false }).populate(POPULATE);
}

function create(data) {
  return InventoryItem.create(data);
}

async function updateById(id, patch) {
  const item = await InventoryItem.findOneAndUpdate({ _id: id, isDeleted: false }, patch, { new: true });
  return item ? item.populate(POPULATE) : null;
}

function softDeleteById(id) {
  return InventoryItem.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { new: true });
}

module.exports = { list, findById, create, updateById, softDeleteById };
