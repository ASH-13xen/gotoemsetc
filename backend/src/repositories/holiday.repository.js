const Holiday = require('../models/Holiday');

function list({ from, to } = {}) {
  const query = {};
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = from;
    if (to) query.date.$lte = to;
  }
  return Holiday.find(query).sort({ date: 1 });
}

function create(data) {
  return Holiday.create(data);
}

function removeById(id) {
  return Holiday.findByIdAndDelete(id);
}

module.exports = { list, create, removeById };
