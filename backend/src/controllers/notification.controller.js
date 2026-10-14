const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');
const notificationRepository = require('../repositories/notification.repository');
const { NOTIFICATION_TYPES } = require('../config/constants');

const list = asyncHandler(async (req, res) => {
  const notifications = await notificationService.listForUser(req.user.id, req.query);
  res.json({ notifications });
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.unreadCount(req.user.id);
  res.json({ count });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(req.params.id, req.user.id);
  res.json({ notification });
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user.id);
  res.status(204).send();
});

// The dashboard alerts: who joined or left, until dismissed.
const alerts = asyncHandler(async (req, res) => {
  const notifications = await notificationRepository.listUnreadByTypes(req.user.id, [
    NOTIFICATION_TYPES.EMPLOYEE_ONBOARDED,
    NOTIFICATION_TYPES.EMPLOYEE_OFFBOARDED,
  ]);
  res.json({ notifications });
});

module.exports = { list, unreadCount, markRead, markAllRead, alerts };
