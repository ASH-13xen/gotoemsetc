const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAnnouncementCreateAccess } = require('../middlewares/auth.middleware');
const announcementValidator = require('../validators/announcement.validator');
const announcementController = require('../controllers/announcement.controller');

const router = Router();

// Self-scoped reads — any authenticated employee, workers included, can see
// and acknowledge what was sent to them. Creating (and browsing the full
// management list) is gated to every non-worker role.
router.get('/mine/pending', announcementController.listMinePending);
router.post(
  '/:id/acknowledge',
  validate(announcementValidator.acknowledge),
  announcementController.acknowledge
);

router.get('/', requireAnnouncementCreateAccess(), announcementController.list);
router.post(
  '/',
  requireAnnouncementCreateAccess(),
  validate(announcementValidator.create),
  announcementController.create
);

module.exports = router;
