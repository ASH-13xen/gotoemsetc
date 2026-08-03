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

// Unread notifications of a specific type for one recipient, oldest first —
// backs the login-time "pending attendance warnings" check. Populating
// attendanceWarning gives the caller the category/date/message it needs
// without a second round-trip.
function listUnreadByType(recipientId, type) {
  return Notification.find({ recipient: recipientId, type, isRead: false })
    .populate('attendanceWarning')
    .sort({ createdAt: 1 });
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

module.exports = { createMany, listForRecipient, unreadCount, listUnreadByType, markRead, markAllRead };
