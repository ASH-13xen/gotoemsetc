const ClientNote = require('../models/ClientNote');

function create(data) {
  return ClientNote.create(data);
}

function listByClient(clientId) {
  return ClientNote.find({ client: clientId })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'username role');
}

function findById(id) {
  return ClientNote.findById(id);
}

function deleteById(id) {
  return ClientNote.findByIdAndDelete(id);
}

module.exports = { create, listByClient, findById, deleteById };
