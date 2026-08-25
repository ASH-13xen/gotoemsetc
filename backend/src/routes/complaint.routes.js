const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireOperationsAccess } = require('../middlewares/auth.middleware');
const complaintValidator = require('../validators/complaint.validator');
const complaintController = require('../controllers/complaint.controller');

const router = Router();

// Any employee can file and browse/review their own complaints — only the
// list-everyone and mark-completed actions are Operations-only, gated
// per-route below rather than at the mount (same pattern as
// work-teams/task-clients: every employee needs baseline access here).
router.get('/mine/awaiting-review', complaintController.mineAwaitingReview);

router.post('/', validate(complaintValidator.create), complaintController.file);
router.get('/', validate(complaintValidator.list), complaintController.list);
router.post(
  '/:id/complete',
  requireOperationsAccess(),
  validate(complaintValidator.complete),
  complaintController.complete
);
router.post('/:id/review', validate(complaintValidator.review), complaintController.review);

module.exports = router;
