const asyncHandler = require('../utils/asyncHandler');
const weeklyCalendarService = require('../services/weeklyCalendar.service');
const weeklyCalendarPdf = require('../services/weeklyCalendarPdf.service');

function audit(req, action, eventId, metadata) {
  req.auditContext = { action, resourceType: 'WeeklyEvent', resourceId: eventId, metadata };
}

// The signed-in person with their live roles and access (access.service.js).
const viewer = (req) => req.user;

const people = asyncHandler(async (req, res) => {
  res.json(await weeklyCalendarService.listPeople());
});

const week = asyncHandler(async (req, res) => {
  res.json(await weeklyCalendarService.getWeek(viewer(req), { start: req.query.start, userId: req.query.user }));
});

const weekPdf = asyncHandler(async (req, res) => {
  const { pdf, filename } = await weeklyCalendarPdf.renderWeekPdf(viewer(req), { start: req.query.start, userId: req.query.user });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
  res.send(pdf);
});

const busy = asyncHandler(async (req, res) => {
  res.json(await weeklyCalendarService.getBusy(viewer(req), { start: req.query.start, userIds: req.query.users }));
});

const invites = asyncHandler(async (req, res) => {
  res.json({ invites: await weeklyCalendarService.listMyInvites(viewer(req)) });
});

const getEvent = asyncHandler(async (req, res) => {
  res.json({ event: await weeklyCalendarService.getEvent(viewer(req), req.params.id) });
});

const createEvent = asyncHandler(async (req, res) => {
  const result = await weeklyCalendarService.createEvent(viewer(req), req.body);
  audit(req, 'weeklyCalendar.create', result.events[0]?._id, {
    title: req.body.title,
    dates: result.count,
    invitees: req.body.invitees?.length ?? 0,
    isPersonal: Boolean(req.body.isPersonal),
  });
  res.status(201).json(result);
});

const updateEvent = asyncHandler(async (req, res) => {
  const event = await weeklyCalendarService.updateEvent(viewer(req), req.params.id, req.body);
  audit(req, 'weeklyCalendar.update', req.params.id, req.body);
  res.json({ event });
});

const cancelEvent = asyncHandler(async (req, res) => {
  const result = await weeklyCalendarService.cancelEvent(viewer(req), req.params.id, req.body);
  audit(req, 'weeklyCalendar.cancel', req.params.id, { ...req.body, cancelled: result.cancelled });
  res.json(result);
});

const invite = asyncHandler(async (req, res) => {
  const event = await weeklyCalendarService.inviteMore(viewer(req), req.params.id, req.body);
  audit(req, 'weeklyCalendar.invite', req.params.id, req.body);
  res.json({ event });
});

const removeAttendee = asyncHandler(async (req, res) => {
  const event = await weeklyCalendarService.removeAttendee(viewer(req), req.params.id, req.params.userId, req.query);
  audit(req, 'weeklyCalendar.removeAttendee', req.params.id, { userId: req.params.userId });
  res.json({ event });
});

const respond = asyncHandler(async (req, res) => {
  const result = await weeklyCalendarService.respond(viewer(req), req.params.id, req.body);
  audit(req, `weeklyCalendar.${req.body.response}`, req.params.id, { scope: req.body.scope, ...result });
  res.json(result);
});

const join = asyncHandler(async (req, res) => {
  const event = await weeklyCalendarService.join(viewer(req), req.params.id);
  audit(req, 'weeklyCalendar.join', req.params.id);
  res.json({ event });
});

const segments = asyncHandler(async (req, res) => {
  const event = await weeklyCalendarService.setSegments(viewer(req), req.params.id, req.body.segments);
  audit(req, 'weeklyCalendar.segments', req.params.id, { count: req.body.segments.length });
  res.json({ event });
});

const addNote = asyncHandler(async (req, res) => {
  const event = await weeklyCalendarService.addNote(viewer(req), req.params.id, req.body);
  audit(req, 'weeklyCalendar.note.add', req.params.id, { kind: req.body.kind });
  res.status(201).json({ event });
});

const updateNote = asyncHandler(async (req, res) => {
  const event = await weeklyCalendarService.updateNote(viewer(req), req.params.id, req.params.noteId, req.body);
  audit(req, 'weeklyCalendar.note.update', req.params.id, { noteId: req.params.noteId });
  res.json({ event });
});

const deleteNote = asyncHandler(async (req, res) => {
  const event = await weeklyCalendarService.deleteNote(viewer(req), req.params.id, req.params.noteId);
  audit(req, 'weeklyCalendar.note.delete', req.params.id, { noteId: req.params.noteId });
  res.json({ event });
});

const noteToTask = asyncHandler(async (req, res) => {
  const event = await weeklyCalendarService.noteToTask(viewer(req), req.params.id, req.params.noteId);
  audit(req, 'weeklyCalendar.note.toTask', req.params.id, { noteId: req.params.noteId });
  res.json({ event });
});

const copyWeek = asyncHandler(async (req, res) => {
  const result = await weeklyCalendarService.copyWeek(viewer(req), req.body);
  audit(req, 'weeklyCalendar.copyWeek', null, { ...req.body, created: result.created });
  res.json(result);
});

// ---- Public (from the invite email; no login) ----
const publicInvite = asyncHandler(async (req, res) => {
  res.json({ invite: await weeklyCalendarService.getPublicInvite(req.params.token) });
});

const publicRespond = asyncHandler(async (req, res) => {
  const result = await weeklyCalendarService.respondPublic(req.params.token, req.body);
  res.json(result);
});

module.exports = {
  people,
  week,
  weekPdf,
  busy,
  invites,
  getEvent,
  createEvent,
  updateEvent,
  cancelEvent,
  invite,
  removeAttendee,
  respond,
  join,
  segments,
  addNote,
  updateNote,
  deleteNote,
  noteToTask,
  copyWeek,
  publicInvite,
  publicRespond,
};
