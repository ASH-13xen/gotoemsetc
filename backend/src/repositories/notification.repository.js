const Notification = require('../models/Notification');

function createMany(docs) {
  return Notification.insertMany(docs);
}

function listForRecipient(recipientId, { unreadOnly = false, limit = 50 } = {}) {
  const query = { recipient: recipientId };
  if (unreadOnly) query.isRead = false;
  return Notification.find(query).sort({ createdAt: -1 }).limit(limit);
}

function unreadCount(recipientId) {
  return Notification.countDocuments({ recipient: recipientId, isRead: false });
}

function markRead(id, recipientId) {
  return Notification.findOneAndUpdate(
    { _id: id, recipient: recipientId },
    { isRead: true },
    { returnDocument: 'after' }
  );
}

function markAllRead(recipientId) {
  return Notification.updateMany({ recipient: recipientId, isRead: false }, { isRead: true });
}

module.exports = { createMany, listForRecipient, unreadCount, markRead, markAllRead };
