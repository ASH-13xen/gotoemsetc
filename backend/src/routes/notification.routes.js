const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const notificationValidator = require('../validators/notification.validator');
const notificationController = require('../controllers/notification.controller');

const router = Router();

router.get('/', validate(notificationValidator.list), notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', validate(notificationValidator.markRead), notificationController.markRead);

module.exports = router;
