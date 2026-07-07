const AuditLog = require('../models/AuditLog');

function create(data) {
  return AuditLog.create(data);
}

function listQuery({ resourceType, resourceId, actorUsername, from, to }) {
  const query = {};
  if (resourceType) query.resourceType = resourceType;
  if (resourceId) query.resourceId = resourceId;
  if (actorUsername) query['actor.username'] = new RegExp(actorUsername.trim(), 'i');
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
  }
  return query;
}

async function list({ resourceType, resourceId, actorUsername, from, to, page = 1, limit = 50 }) {
  const query = listQuery({ resourceType, resourceId, actorUsername, from, to });
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(query),
  ]);

  return { items, total, page, limit };
}

module.exports = { create, list };
