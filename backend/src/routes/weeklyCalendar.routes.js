const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const v = require('../validators/weeklyCalendar.validator');
const c = require('../controllers/weeklyCalendar.controller');

// Every signed-in user has a Weekly Calendar. Who may change what (host vs
// guest vs admin) is decided per event in weeklyCalendar.service.js.
const router = Router();

router.get('/people', c.people);
router.get('/week', validate(v.week), c.week);
router.get('/week/pdf', validate(v.week), c.weekPdf);
router.get('/busy', validate(v.busy), c.busy);
router.get('/invites', c.invites);
router.post('/copy-week', validate(v.copyWeek), c.copyWeek);

router.post('/events', validate(v.createEvent), c.createEvent);
router.get('/events/:id', validate(v.idParam), c.getEvent);
router.patch('/events/:id', validate(v.updateEvent), c.updateEvent);
router.post('/events/:id/cancel', validate(v.cancelEvent), c.cancelEvent);
router.post('/events/:id/invite', validate(v.invite), c.invite);
router.delete('/events/:id/attendees/:userId', validate(v.removeAttendee), c.removeAttendee);
router.post('/events/:id/respond', validate(v.respond), c.respond);
router.post('/events/:id/join', validate(v.idParam), c.join);
router.put('/events/:id/segments', validate(v.segments), c.segments);

router.post('/events/:id/notes', validate(v.addNote), c.addNote);
router.patch('/events/:id/notes/:noteId', validate(v.updateNote), c.updateNote);
router.delete('/events/:id/notes/:noteId', validate(v.noteParams), c.deleteNote);
router.post('/events/:id/notes/:noteId/task', validate(v.noteParams), c.noteToTask);

module.exports = router;
