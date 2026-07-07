const auditLogRepository = require('../repositories/auditLog.repository');
const logger = require('../utils/logger');

// Audit logging is best-effort — a logging failure must never break the
// primary operation that triggered it.
async function record({ actor, action, resourceType, resourceId, metadata }) {
  try {
    await auditLogRepository.create({
      actor: actor ? { userId: actor.id, username: actor.username, role: actor.role } : undefined,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : undefined,
      metadata,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to write audit log');
  }
}

async function list(filters) {
  return auditLogRepository.list(filters);
}

module.exports = { record, list };
