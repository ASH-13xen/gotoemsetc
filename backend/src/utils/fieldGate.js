const sensitiveFields = require('../config/sensitiveFields');
const { can } = require('./roles');
const { ACCESS } = require('../config/access');

function stripFields(doc, fields) {
  if (!doc) return doc;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const shaped = { ...plain };
  for (const field of fields) delete shaped[field];
  return shaped;
}

// Single flip-point for field redaction. Anyone without EMS-for-everyone
// access (admin, CEO, HR — by login or post) never sees
// sensitiveFields[resourceType] on the way out, whichever endpoint the
// document came through.
function shapeForRole(resourceType, doc, viewer) {
  const fields = sensitiveFields[resourceType];
  if (!fields || !fields.length || can(viewer, ACCESS.EMS_ALL) || !doc) return doc;

  return Array.isArray(doc) ? doc.map((item) => stripFields(item, fields)) : stripFields(doc, fields);
}

module.exports = { shapeForRole };
