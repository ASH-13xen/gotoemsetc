const activityLogRepository = require('../repositories/activityLog.repository');
const logger = require('../utils/logger');

// Activity logging is best-effort — a logging failure must never break the
// primary operation (creating an employee, generating a document, etc.).
async function log(employeeId, action, metadata = {}, actorType = 'admin') {
  try {
    await activityLogRepository.create({ employee: employeeId, action, metadata, actorType });
  } catch (err) {
    logger.error({ err }, 'Failed to write activity log');
  }
}

async function listForEmployee(employeeId) {
  return activityLogRepository.listByEmployee(employeeId);
}

module.exports = { log, listForEmployee };
