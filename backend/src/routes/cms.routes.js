const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const {
  requireCmsWrite,
  requireCanScheduleForCalendar,
} = require('../middlewares/cmsAccess.middleware');
const cmsValidator = require('../validators/cms.validator');
const cmsController = require('../controllers/cms.controller');

const router = Router();

// Reads are open to any logged-in employee. Writes split two ways:
//   requireCmsWrite            — the client's plan and calendars themselves
//                                (admin/Digital Admin, plus HR-equivalent
//                                task admins)
//   requireCanScheduleForCalendar — scheduling and assigning content, which
//                                Team Main may also do, but only on their
//                                own team's calendar
//
// Pipeline decisions (advance/send-back/reject) are authorised per-step
// inside calendarItemService via cmsWorkflow.canActOnCurrentStep, since who
// may act depends on which step the item currently sits at — a role check
// at the route couldn't express that.

// ---- Calendars ----
router.get('/calendars', validate(cmsValidator.listCalendars), cmsController.listCalendars);
router.post('/calendars', requireCmsWrite(), validate(cmsValidator.createCalendar), cmsController.createCalendar);
router.get('/calendars/:id', validate(cmsValidator.getOrDelete), cmsController.getCalendarView);
router.patch(
  '/calendars/:id',
  requireCmsWrite(),
  validate(cmsValidator.updateCalendar),
  cmsController.updateCalendar
);
router.delete(
  '/calendars/:id',
  requireCmsWrite(),
  validate(cmsValidator.getOrDelete),
  cmsController.deleteCalendar
);

router.get('/calendars/:id/report', validate(cmsValidator.getOrDelete), cmsController.getReport);
router.post(
  '/calendars/:id/close',
  requireCmsWrite(),
  validate(cmsValidator.getOrDelete),
  cmsController.closeMonth
);

// ---- Scheduling ----
router.post(
  '/calendars/:calendarId/items',
  validate(cmsValidator.scheduleItem),
  requireCanScheduleForCalendar(),
  cmsController.scheduleItem
);

// ---- Items ----
router.get('/items/:id', validate(cmsValidator.getOrDelete), cmsController.getItem);
router.patch('/items/:id/brief', validate(cmsValidator.updateBrief), cmsController.updateBrief);
router.post('/items/:id/reschedule', validate(cmsValidator.reschedule), cmsController.reschedule);
router.post('/items/:id/reassign', validate(cmsValidator.reassign), cmsController.reassign);
router.delete('/items/:id', requireCmsWrite(), validate(cmsValidator.getOrDelete), cmsController.deleteItem);

// ---- Pipeline ----
router.post('/items/:id/advance', validate(cmsValidator.decision), cmsController.advance);
router.post('/items/:id/send-back', validate(cmsValidator.decision), cmsController.sendBack);
router.post('/items/:id/reject', validate(cmsValidator.reject), cmsController.reject);

module.exports = router;
