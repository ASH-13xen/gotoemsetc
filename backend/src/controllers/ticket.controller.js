const asyncHandler = require('../utils/asyncHandler');
const ticketService = require('../services/ticket.service');
const calendarTickets = require('../services/calendarTickets.service');
const taskCalendar = require('../services/taskCalendar.service');

const audit = (req, action, ticket) => {
  req.auditContext = { action, resourceType: 'Ticket', resourceId: ticket._id, metadata: { code: ticket.code } };
};

const meta = asyncHandler(async (req, res) => {
  res.json(await ticketService.meta(req.user));
});

const list = asyncHandler(async (req, res) => {
  res.json({ tickets: await ticketService.list(req.user, req.query) });
});

const summary = asyncHandler(async (req, res) => {
  const [tickets, calendarWaiting] = await Promise.all([ticketService.summary(req.user), calendarTickets.countMine(req.user)]);
  res.json({ ...tickets, calendarWaiting });
});

const analysis = asyncHandler(async (req, res) => {
  res.json(await ticketService.analysis(req.user, req.query));
});

const get = asyncHandler(async (req, res) => {
  res.json({ ticket: await ticketService.get(req.user, req.params.id) });
});

const raise = asyncHandler(async (req, res) => {
  const ticket = await ticketService.raise(req.user, req.body);
  audit(req, 'ticket.raise', ticket);
  res.status(201).json({ ticket });
});

const advance = asyncHandler(async (req, res) => {
  const ticket = await ticketService.advance(req.user, req.params.id, req.body);
  audit(req, 'ticket.advance', ticket);
  res.json({ ticket });
});

const sendBack = asyncHandler(async (req, res) => {
  const ticket = await ticketService.sendBack(req.user, req.params.id, req.body);
  audit(req, 'ticket.sendBack', ticket);
  res.json({ ticket });
});

const reject = asyncHandler(async (req, res) => {
  const ticket = await ticketService.reject(req.user, req.params.id, req.body);
  audit(req, 'ticket.reject', ticket);
  res.json({ ticket });
});

const edit = asyncHandler(async (req, res) => {
  const ticket = await ticketService.edit(req.user, req.params.id, req.body);
  audit(req, 'ticket.edit', ticket);
  res.json({ ticket });
});

const reassign = asyncHandler(async (req, res) => {
  const ticket = await ticketService.reassign(req.user, req.params.id, req.body);
  audit(req, 'ticket.reassign', ticket);
  res.json({ ticket });
});

const comment = asyncHandler(async (req, res) => {
  res.json({ ticket: await ticketService.comment(req.user, req.params.id, req.body) });
});

const addLink = asyncHandler(async (req, res) => {
  res.json({ ticket: await ticketService.addLink(req.user, req.params.id, req.body) });
});

const ceoReview = asyncHandler(async (req, res) => {
  const ticket = await ticketService.ceoReview(req.user, req.params.id, req.body);
  audit(req, 'ticket.ceoReview', ticket);
  res.json({ ticket });
});

// ---- the Task Calendar ----

const taskCalendarView = asyncHandler(async (req, res) => {
  res.json(await taskCalendar.entries(req.user, req.query));
});

// ---- content calendar work, shown as tickets ----

const calendarList = asyncHandler(async (req, res) => {
  res.json({ tickets: await calendarTickets.list(req.user, req.query) });
});

const calendarItem = asyncHandler(async (req, res) => {
  res.json({ ticket: await calendarTickets.getItem(req.user, req.params.id) });
});

const calendarStories = asyncHandler(async (req, res) => {
  res.json({ ticket: await calendarTickets.getStories(req.user, req.params.id) });
});

const calendarAct = (action) =>
  asyncHandler(async (req, res) => {
    res.json({ ticket: await calendarTickets.act(req.user, req.params.id, action, req.body) });
  });

module.exports = {
  meta,
  list,
  summary,
  analysis,
  get,
  raise,
  advance,
  sendBack,
  reject,
  edit,
  reassign,
  comment,
  addLink,
  ceoReview,
  taskCalendarView,
  calendarList,
  calendarItem,
  calendarStories,
  calendarAdvance: calendarAct('advance'),
  calendarSendBack: calendarAct('send-back'),
  calendarReject: calendarAct('reject'),
};
