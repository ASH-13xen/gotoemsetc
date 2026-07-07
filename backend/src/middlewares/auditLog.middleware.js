const auditLogService = require('../services/auditLog.service');

// Controllers that perform a mutation set `req.auditContext = { action, resourceType,
// resourceId, metadata }` right before responding. This middleware fires after the
// response is sent, so it never adds latency to the request and never fails it.
function auditLogger(req, res, next) {
  res.on('finish', () => {
    if (!req.auditContext || res.statusCode >= 400) return;
    auditLogService.record({ actor: req.user, ...req.auditContext });
  });
  next();
}

module.exports = auditLogger;
