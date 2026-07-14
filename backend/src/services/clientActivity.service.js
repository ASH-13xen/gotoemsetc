const clientActivityLogRepository = require('../repositories/clientActivityLog.repository');
const logger = require('../utils/logger');

// Best-effort, same as the employee-side activity.service.js — a logging
// failure must never break the primary operation.
async function log(clientId, action, metadata = {}, actorType = 'admin') {
  try {
    await clientActivityLogRepository.create({ client: clientId, action, metadata, actorType });
  } catch (err) {
    logger.error({ err }, 'Failed to write client activity log');
  }
}

async function listForClient(clientId) {
  return clientActivityLogRepository.listByClient(clientId);
}

module.exports = { log, listForClient };
