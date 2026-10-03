const ClientPortalAccount = require('../models/ClientPortalAccount');

const CLIENT_FIELDS = 'name brandName logoUrl';

function findByUsername(username) {
  return ClientPortalAccount.findOne({ username: username.toLowerCase(), isActive: true })
    .select('+passwordHash')
    .populate('taskClient', CLIENT_FIELDS);
}

function findById(id) {
  return ClientPortalAccount.findById(id).populate('taskClient', CLIENT_FIELDS);
}

module.exports = { findByUsername, findById };
