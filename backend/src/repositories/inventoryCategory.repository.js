const InventoryCategory = require('../models/InventoryCategory');

function list() {
  return InventoryCategory.find({ isDeleted: false }).sort({ name: 1 });
}

function findById(id) {
  return InventoryCategory.findOne({ _id: id, isDeleted: false });
}

function findByName(name) {
  return InventoryCategory.findOne({ name, isDeleted: false });
}

function create(data) {
  return InventoryCategory.create(data);
}

module.exports = { list, findById, findByName, create };
