const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const meetingValidator = require('../validators/meeting.validator');
const meetingController = require('../controllers/meeting.controller');

const router = Router();

// Reads are open to any logged-in employee, same as the rest of the CMS —
// scoping to "clients I can actually see" happens wherever a client is
// fetched, not here. Writes (schedule/log/reschedule/cancel/MOM) are
// authorised inside meeting.service.js via cmsAccess.canManageMeetings,
// which needs the client's team loaded first — a route-level role check
// couldn't express that, same reasoning as cms.routes.js.
router.get('/client/:clientId', validate(meetingValidator.clientIdParam), meetingController.listForClient);
router.get('/:id', validate(meetingValidator.getOrDelete), meetingController.get);
router.post('/', validate(meetingValidator.schedule), meetingController.schedule);
router.post('/log', validate(meetingValidator.log), meetingController.log);
router.post('/:id/reschedule', validate(meetingValidator.reschedule), meetingController.reschedule);
router.post('/:id/cancel', validate(meetingValidator.cancel), meetingController.cancel);
router.post('/:id/mom', validate(meetingValidator.submitMom), meetingController.submitMom);
router.post('/:id/tasks', validate(meetingValidator.addTask), meetingController.addTask);

module.exports = router;
