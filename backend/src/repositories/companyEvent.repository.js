const CompanyEvent = require('../models/CompanyEvent');

function list() {
  return CompanyEvent.find().sort({ date: 1 });
}

function create(data) {
  return CompanyEvent.create(data);
}

function removeById(id) {
  return CompanyEvent.findByIdAndDelete(id);
}

module.exports = { list, create, removeById };
