const User = require('../models/User');

function findByUsername(username) {
  return User.findOne({ username: username.toLowerCase(), isActive: true }).select('+passwordHash');
}

function findById(id) {
  return User.findOne({ _id: id, isActive: true });
}

function create(data) {
  return User.create(data);
}

function list() {
  return User.find({ isActive: true }).sort({ username: 1 });
}

module.exports = { findByUsername, findById, create, list };
