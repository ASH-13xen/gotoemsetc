const ApiError = require('../utils/ApiError');
const TicketPlan = require('../models/TicketPlan');
const ticketService = require('./ticket.service');
const calendarTickets = require('./calendarTickets.service');

// ---------------------------------------------------------------------------
// Planned ticket work on the Weekly Calendar (models/TicketPlan.js). Each
// person's own: listed, moved, resized and removed only by them, never shown
// to anyone else, never busy, free to overlap anything. Planning needs no
// more than being able to see the ticket — whether it still waits on them is
// for the screen to show.
// ---------------------------------------------------------------------------

const idOf = (v) => (v ? String(v._id || v) : null);

function view(plan) {
  return {
    _id: idOf(plan._id),
    kind: plan.kind,
    ref: idOf(plan.ref),
    code: plan.code || '',
    title: plan.title || '',
    day: plan.day,
    startMin: plan.startMin,
    endMin: plan.endMin,
  };
}

// The ticket (or calendar work) being planned, if this person can see it.
async function describe(user, kind, ref) {
  if (kind === 'ticket') return ticketService.canViewTicket(user, ref);
  const card = kind === 'stories' ? await calendarTickets.getStories(user, ref) : await calendarTickets.getItem(user, ref);
  return { code: card.code, title: card.title };
}

async function list(user, { from, to }) {
  const plans = await TicketPlan.find({ user: user.id, day: { $gte: from, $lte: to } }).sort({ day: 1, startMin: 1 }).lean();
  return plans.map(view);
}

async function create(user, { kind, ref, day, startMin, endMin }) {
  const { code, title } = await describe(user, kind, ref);
  const plan = await TicketPlan.create({ user: user.id, kind, ref, code, title, day, startMin, endMin });
  return view(plan);
}

async function update(user, id, { day, startMin, endMin }) {
  const plan = await TicketPlan.findOne({ _id: id, user: user.id });
  if (!plan) throw ApiError.notFound('Plan not found');
  if (day !== undefined) plan.day = day;
  if (startMin !== undefined) plan.startMin = startMin;
  if (endMin !== undefined) plan.endMin = endMin;
  if (plan.endMin - plan.startMin < 15) throw ApiError.badRequest('Plan at least 15 minutes');
  await plan.save();
  return view(plan);
}

async function remove(user, id) {
  const res = await TicketPlan.deleteOne({ _id: id, user: user.id });
  if (!res.deletedCount) throw ApiError.notFound('Plan not found');
  return { removed: true };
}

module.exports = { list, create, update, remove };
