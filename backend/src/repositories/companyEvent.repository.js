const CompanyEvent = require('../models/CompanyEvent');

// Populated with enough of `client` to resolve recipients for a
// client-scoped reminder (see birthdayReminder.job.js) without a second
// query per event.
const CLIENT_POPULATE = {
  path: 'client',
  select: 'name defaultTeam',
  populate: { path: 'defaultTeam', select: 'leader members' },
};

function list() {
  return CompanyEvent.find().sort({ date: 1 }).populate(CLIENT_POPULATE);
}

function listForClient(clientId) {
  return CompanyEvent.find({ client: clientId }).sort({ date: 1 });
}

function create(data) {
  return CompanyEvent.create(data);
}

function findById(id) {
  return CompanyEvent.findById(id);
}

function removeById(id) {
  return CompanyEvent.findByIdAndDelete(id);
}

module.exports = { list, listForClient, create, findById, removeById };
