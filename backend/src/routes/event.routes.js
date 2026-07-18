const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireRole } = require('../middlewares/auth.middleware');
const { USER_ROLES } = require('../config/constants');
const eventValidator = require('../validators/event.validator');
const eventController = require('../controllers/event.controller');

const router = Router();

// Must come before /:id — otherwise Express matches "my-responsibilities"
// as an :id.
router.get('/my-responsibilities', eventController.myResponsibilities);

router.get('/', eventController.list);
router.post('/', validate(eventValidator.createEvent), eventController.create);
router.get('/:id', validate(eventValidator.getOrDeleteEvent), eventController.getById);
router.patch('/:id', validate(eventValidator.updateEvent), eventController.update);
router.delete('/:id', validate(eventValidator.getOrDeleteEvent), eventController.remove);

router.post('/:id/reschedule', validate(eventValidator.rescheduleEvent), eventController.reschedule);
router.post('/:id/complete', validate(eventValidator.getOrDeleteEvent), eventController.complete);
router.post('/:id/cancel', validate(eventValidator.getOrDeleteEvent), eventController.cancel);
// Only admin fills in the after-the-fact summary, per the product ask.
router.patch(
  '/:id/summary',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.HR),
  validate(eventValidator.fillSummary),
  eventController.fillSummary
);

router.post(
  '/:id/responsibilities',
  validate(eventValidator.createResponsibility),
  eventController.createResponsibility
);

router.patch(
  '/responsibilities/:id',
  validate(eventValidator.updateResponsibility),
  eventController.updateResponsibility
);
router.post(
  '/responsibilities/:id/status',
  validate(eventValidator.setResponsibilityStatus),
  eventController.setResponsibilityStatus
);
router.delete(
  '/responsibilities/:id',
  validate(eventValidator.getOrDeleteEvent),
  eventController.removeResponsibility
);

module.exports = router;
