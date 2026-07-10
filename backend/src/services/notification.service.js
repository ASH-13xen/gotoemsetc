const notificationRepository = require('../repositories/notification.repository');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// Best-effort, same convention as activity.service.js — a failure to write
// an in-app notification must never break the interview/hire/reject action
// that triggered it.
async function createForUsers(userIds, { type, title, message, applicant, interview, employee }) {
  const uniqueIds = [...new Set(userIds.map((id) => id.toString()))];
  if (uniqueIds.length === 0) return;

  try {
    await notificationRepository.createMany(
      uniqueIds.map((recipient) => ({ recipient, type, title, message, applicant, interview, employee }))
    );
  } catch (err) {
    logger.error({ err, type, userIds: uniqueIds }, 'Failed to create notifications');
  }
}

function listForUser(userId, params) {
  return notificationRepository.listForRecipient(userId, params);
}

function unreadCount(userId) {
  return notificationRepository.unreadCount(userId);
}

async function markRead(id, userId) {
  const notification = await notificationRepository.markRead(id, userId);
  if (!notification) throw ApiError.notFound('Notification not found');
  return notification;
}

function markAllRead(userId) {
  return notificationRepository.markAllRead(userId);
}

module.exports = { createForUsers, listForUser, unreadCount, markRead, markAllRead };
