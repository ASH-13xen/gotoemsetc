const ClientActivityLog = require('../models/ClientActivityLog');

function create(data) {
  return ClientActivityLog.create(data);
}

function listByClient(clientId) {
  return ClientActivityLog.find({ client: clientId }).sort({ createdAt: -1 });
}

module.exports = { create, listByClient };
