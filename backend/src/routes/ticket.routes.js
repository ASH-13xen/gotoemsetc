const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireFeature } = require('../middlewares/feature.middleware');
const v = require('../validators/ticket.validator');
const c = require('../controllers/ticket.controller');

// Task Management, as tickets — see services/ticket.service.js. Who may do
// what depends on the Organisation chart and on the step a ticket is at, so
// it is decided in the service, not here. Everything is off while
// FEATURES.TASK_MANAGEMENT is.
const router = Router();
router.use(requireFeature('TASK_MANAGEMENT'));

// Literal paths before /:id.
router.get('/meta', c.meta);
router.get('/summary', c.summary);
router.get('/analysis', validate(v.analysis), c.analysis);
// The Task Calendar — CEO/admin see every ticket, others the ones they raised or are on.
router.get('/task-calendar', validate(v.taskCalendar), c.taskCalendarView);
// Ticket work planned on the Weekly Calendar — each person's own.
router.get('/plans', validate(v.planList), c.plans);
router.post('/plans', validate(v.planCreate), c.planCreate);
router.patch('/plans/:id', validate(v.planUpdate), c.planUpdate);
router.delete('/plans/:id', validate(v.idParam), c.planRemove);

// The content calendar's work, shown as tickets.
router.get('/calendar', validate(v.calendarList), c.calendarList);
router.get('/calendar/stories/:id', validate(v.idParam), c.calendarStories);
router.get('/calendar/items/:id', validate(v.idParam), c.calendarItem);
router.post('/calendar/items/:id/advance', validate(v.calendarDecision), c.calendarAdvance);
router.post('/calendar/items/:id/send-back', validate(v.calendarDecision), c.calendarSendBack);
router.post('/calendar/items/:id/reject', validate(v.reason), c.calendarReject);

router.get('/', validate(v.list), c.list);
router.post('/', validate(v.raise), c.raise);
router.post('/repeats/:id/stop', validate(v.stopRepeat), c.stopRepeat);
router.get('/:id', validate(v.idParam), c.get);
router.patch('/:id', validate(v.edit), c.edit);
router.post('/:id/advance', validate(v.note), c.advance);
router.post('/:id/send-back', validate(v.requiredNote), c.sendBack);
router.post('/:id/reject', validate(v.reason), c.reject);
router.post('/:id/reassign', validate(v.reassign), c.reassign);
router.post('/:id/comments', validate(v.comment), c.comment);
router.post('/:id/links', validate(v.link), c.addLink);
router.post('/:id/ceo-review', validate(v.note), c.ceoReview);

module.exports = router;
