const sensitiveFields = require('../config/sensitiveFields');
const { USER_ROLES } = require('../config/constants');

// Single flip-point for role-based field redaction. Today it is a no-op for
// every role — both admin and worker see everything — until exact visibility
// rules are specified. When that happens, strip `sensitiveFields[resourceType]`
// from the returned object for USER_ROLES.WORKER here, nowhere else.
function shapeForRole(resourceType, doc, role) {
  void sensitiveFields[resourceType];
  void USER_ROLES;
  return doc;
}

module.exports = { shapeForRole };
