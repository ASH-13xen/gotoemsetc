const sensitiveFields = require('../config/sensitiveFields');
const { isAdminLike } = require('./roles');

function stripFields(doc, fields) {
  if (!doc) return doc;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const shaped = { ...plain };
  for (const field of fields) delete shaped[field];
  return shaped;
}

// Single flip-point for role-based field redaction. Non-admin roles never see
// sensitiveFields[resourceType] on the way out, regardless of which endpoint
// the document came through. Admin always sees everything.
function shapeForRole(resourceType, doc, role) {
  const fields = sensitiveFields[resourceType];
  if (!fields || !fields.length || isAdminLike({ role }) || !doc) return doc;

  return Array.isArray(doc) ? doc.map((item) => stripFields(item, fields)) : stripFields(doc, fields);
}

module.exports = { shapeForRole };
