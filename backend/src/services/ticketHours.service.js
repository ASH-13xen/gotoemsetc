const ApiError = require('../utils/ApiError');
const WorkLog = require('../models/WorkLog');
const Ticket = require('../models/Ticket');
const TicketEvent = require('../models/TicketEvent');
const Employee = require('../models/Employee');
const org = require('./orgHierarchy.service');
const pipe = require('../utils/ticketPipeline');
const holding = require('./holding.service');
const { TICKET_EVENT: EV } = require('../config/constants');

// Hours on a step, confirmed when it is handed on. The person completing
// their step sees an estimate — the timer's total if they used it, else the
// working time they held the ticket for, shared with whatever else they held
// (holding.service.js); an approval is a 15-minute review — and confirms it
// or changes it with a reason (kept and shown as "changed"). When someone
// else completes a step for them (the CEO or admin), the person it waited on
// gets it to confirm later; until then — and if they never do, after three
// days — the estimate stands, marked unconfirmed. Several tickets handed on
// together (a week of stories) share one figure.

const idOf = org.idOf;
const APPROVAL_MINUTES = 15;
const MAX_MINUTES = 16 * 60 * 14; // nobody is asked about more than two weeks of full days
const ticketService = () => require('./ticket.service');
const nameOf = (e) => (e ? `${e.firstName} ${e.lastName || ''}`.trim() : null);
const hhmm = (m) => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`;

// When the ticket last came to this step (or out of a lineup, or was started).
async function sinceOf(ticket) {
  const last = await TicketEvent.findOne({ ticket: ticket._id, type: { $in: [EV.RAISED, EV.STARTED, EV.ADVANCED, EV.RESTARTED, EV.SENT_BACK, EV.UNPARKED] } })
    .sort({ at: -1, _id: -1 })
    .select('at')
    .lean();
  let since = last?.at ? new Date(last.at) : new Date(ticket.createdAt);
  // A ticket parked until a date (posting, shoot day) is held again from it.
  for (const d of [ticket.scheduledFor, ticket.parkedUntil]) {
    if (d && new Date(d) > since && new Date(d) <= new Date()) since = new Date(d);
  }
  return since;
}

async function estimate(employeeId, ticket, step, chart) {
  const since = await sinceOf(ticket);
  if (step.approval) return { minutes: APPROVAL_MINUTES, source: 'approval', since };
  const timer = await WorkLog.find({ ticket: ticket._id, employee: employeeId, deleted: false, superseded: { $ne: true }, source: 'timer', startedAt: { $gte: since } }).lean();
  const timerMinutes = timer.reduce((t, l) => t + (l.endedAt ? l.minutes : Math.max(0, Math.round((Date.now() - new Date(l.startedAt).getTime()) / 60000))), 0);
  if (timerMinutes > 0) return { minutes: timerMinutes, source: 'timer', since };
  const { minutes } = await holding.holdingFor({ employeeIds: new Set([idOf(employeeId)]), from: since, to: new Date(), chart });
  return { minutes: Math.round(minutes.get(idOf(employeeId))?.get(idOf(ticket._id)) || 0), source: 'estimate', since };
}

function checkMinutes(minutes, est, reason) {
  if (minutes === undefined || minutes === null || minutes === '') return { confirmed: null, changed: false };
  const confirmed = Math.round(Number(minutes));
  if (!Number.isFinite(confirmed) || confirmed < 0 || confirmed > MAX_MINUTES) throw ApiError.badRequest('Hours worked: a number of minutes, 0 or more');
  const changed = Math.abs(confirmed - est) >= 1;
  if (changed && !String(reason || '').trim()) throw ApiError.badRequest('Say why the hours differ from the estimate');
  return { confirmed, changed };
}

// Before a step is completed: work out the hours, and refuse a change with
// no reason before anything moves.
async function beforeMove(user, ticket, step, ctx, chart, { minutes, reason } = {}) {
  const entries = [];
  if (!step?.actor) return { entries };
  if (ctx.natural && user.employeeLink) {
    const est = await estimate(user.employeeLink, ticket, step, chart);
    const { confirmed, changed } = checkMinutes(minutes, est.minutes, reason);
    entries.push({ employee: idOf(user.employeeLink), user: user.id, estimate: est.minutes, confirmed, changed, reason: String(reason || '').trim() || undefined, since: est.since, pending: confirmed === null });
  } else {
    // Done for them: each person it waited on by name confirms their own later.
    for (const emp of holding.holderIdsFor(ticket, step, chart)) {
      // eslint-disable-next-line no-await-in-loop
      const est = await estimate(emp, ticket, step, chart);
      entries.push({ employee: emp, user: null, estimate: est.minutes, confirmed: null, changed: false, since: est.since, pending: true });
    }
  }
  return { entries };
}

// After it moved: the hours become a time entry, and the record says so.
async function afterMove(user, moved, step, held, { batch = null } = {}) {
  const now = new Date();
  for (const e of held.entries || []) {
    // The timer's stretches on this step become the confirmed figure.
    // eslint-disable-next-line no-await-in-loop
    const running = await WorkLog.findOne({ ticket: moved._id, employee: e.employee, endedAt: null, deleted: false });
    if (running) {
      running.endedAt = now;
      running.minutes = Math.max(0, Math.round((now - new Date(running.startedAt)) / 60000));
      running.stopReason = 'switched';
      // eslint-disable-next-line no-await-in-loop
      await running.save();
    }
    // eslint-disable-next-line no-await-in-loop
    await WorkLog.updateMany(
      { ticket: moved._id, employee: e.employee, source: 'timer', deleted: false, superseded: { $ne: true }, startedAt: { $gte: e.since } },
      { $set: { superseded: true } }
    );
    const minutes = e.confirmed ?? e.estimate;
    // eslint-disable-next-line no-await-in-loop
    await WorkLog.create({
      employee: e.employee,
      user: e.user,
      kind: 'ticket',
      ticket: moved._id,
      client: moved.client || null,
      step: step.key,
      startedAt: e.since,
      endedAt: now,
      minutes,
      estimateMinutes: e.estimate,
      changed: e.changed,
      reason: e.reason,
      pending: e.pending,
      confirmedAt: e.pending ? null : now,
      batch,
      source: 'confirmed',
    });
    // eslint-disable-next-line no-await-in-loop
    const person = nameOf(await Employee.findById(e.employee).select('firstName lastName').lean());
    // eslint-disable-next-line no-await-in-loop
    await ticketService().record(moved, EV.HOURS, e.pending ? null : user, {
      note: e.pending
        ? `${person}: ${hhmm(minutes)} estimated for "${pipe.stepLabel(moved, step.key)}" — waiting for them to confirm`
        : e.changed
          ? `${person}: ${hhmm(minutes)} for "${pipe.stepLabel(moved, step.key)}" — changed from the estimate of ${hhmm(e.estimate)}: ${e.reason}`
          : `${person}: ${hhmm(minutes)} for "${pipe.stepLabel(moved, step.key)}" (as estimated)`,
      meta: { employee: e.employee, minutes, estimate: e.estimate, changed: e.changed, pending: e.pending },
    });
  }
}

// ---------------------------------------------------------------- what the screens ask

// The estimate for the step this person is about to complete.
async function forStep(user, ticketId) {
  const chart = await org.loadChart();
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  const ctx = await ticketService().actingContext(user, ticket, chart);
  if (!ctx.canAct) throw ApiError.forbidden("This step isn't yours to complete");
  if (!ctx.natural || !user.employeeLink) return { ticket: idOf(ticket._id), ask: false };
  const est = await estimate(user.employeeLink, ticket, ctx.step, chart);
  return {
    ticket: idOf(ticket._id),
    ask: true,
    step: ctx.step.key,
    stepLabel: pipe.stepLabel(ticket, ctx.step.key),
    approval: Boolean(ctx.step.approval),
    since: est.since,
    minutes: est.minutes,
    source: est.source,
  };
}

async function forSteps(user, ids) {
  const out = [];
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await forStep(user, id));
  }
  return { tickets: out, totalMinutes: out.reduce((t, x) => t + (x.minutes || 0), 0) };
}

// Several tickets completed together, one figure shared by their estimates
// (equally when none was estimated).
async function advanceMany(user, ids, { minutes, reason, note } = {}) {
  if (!Array.isArray(ids) || !ids.length) throw ApiError.badRequest('Choose the tickets');
  if (ids.length > 60) throw ApiError.badRequest('At most 60 at a time');
  const est = await forSteps(user, ids);
  const total = est.totalMinutes;
  let shares = null;
  if (minutes !== undefined && minutes !== null && minutes !== '') {
    const confirmed = Math.round(Number(minutes));
    if (!Number.isFinite(confirmed) || confirmed < 0) throw ApiError.badRequest('Hours worked: a number of minutes, 0 or more');
    if (Math.abs(confirmed - total) >= 1 && !String(reason || '').trim()) throw ApiError.badRequest('Say why the hours differ from the estimate');
    shares = est.tickets.map((t) => (total > 0 ? Math.round((confirmed * (t.minutes || 0)) / total) : Math.round(confirmed / est.tickets.length)));
  }
  const done = [];
  for (let i = 0; i < ids.length; i += 1) {
    const per = shares ? shares[i] : undefined;
    // A share that equals its own estimate needs no reason of its own.
    const changed = per !== undefined && Math.abs(per - (est.tickets[i].minutes || 0)) >= 1;
    // eslint-disable-next-line no-await-in-loop
    await ticketService().advance(user, ids[i], { note, minutes: per, reason: changed ? `${String(reason).trim()} (shared across ${ids.length} handed on together)` : undefined });
    done.push(ids[i]);
  }
  return { advanced: done.length };
}

// ---------------------------------------------------------------- waiting to be confirmed

async function pending(user) {
  if (!user.employeeLink) return { entries: [] };
  const logs = await WorkLog.find({ employee: user.employeeLink, pending: true, deleted: false }).sort({ createdAt: -1 }).lean();
  const tickets = new Map((await Ticket.find({ _id: { $in: logs.map((l) => l.ticket) } }).select('number title pipeline').lean()).map((t) => [idOf(t._id), t]));
  return {
    entries: logs.map((l) => {
      const t = tickets.get(idOf(l.ticket));
      return {
        _id: idOf(l._id),
        ticket: t ? { _id: idOf(t._id), code: ticketService().codeOf(t.number), title: t.title } : null,
        stepLabel: t ? pipe.stepLabel(t, l.step) : l.step,
        from: l.startedAt,
        to: l.endedAt,
        estimateMinutes: l.estimateMinutes,
        createdAt: l.createdAt,
      };
    }),
  };
}

async function confirm(user, id, { minutes, reason } = {}) {
  const log = await WorkLog.findOne({ _id: id, pending: true, deleted: false });
  if (!log) throw ApiError.notFound('Nothing to confirm');
  if (idOf(log.employee) !== idOf(user.employeeLink)) throw ApiError.forbidden('These hours are someone else’s to confirm');
  const { confirmed, changed } = checkMinutes(minutes ?? log.estimateMinutes, log.estimateMinutes, reason);
  log.minutes = confirmed;
  log.changed = changed;
  log.reason = changed ? String(reason).trim() : undefined;
  log.pending = false;
  log.confirmedAt = new Date();
  await log.save();
  const ticket = await Ticket.findById(log.ticket);
  if (ticket) {
    await ticketService().record(ticket, EV.HOURS, user, {
      note: changed ? `${hhmm(confirmed)} confirmed for "${pipe.stepLabel(ticket, log.step)}" — changed from ${hhmm(log.estimateMinutes)}: ${log.reason}` : `${hhmm(confirmed)} confirmed for "${pipe.stepLabel(ticket, log.step)}"`,
      meta: { minutes: confirmed, estimate: log.estimateMinutes, changed },
    });
  }
  return pending(user);
}

// Three days on, an unconfirmed estimate stands (marked as never confirmed).
async function autoConfirm(now = new Date()) {
  const res = await WorkLog.updateMany(
    { pending: true, deleted: false, createdAt: { $lte: new Date(now.getTime() - 3 * 86400000) } },
    { $set: { pending: false, autoConfirmed: true, confirmedAt: now } }
  );
  return res.modifiedCount;
}

module.exports = { beforeMove, afterMove, forStep, forSteps, advanceMany, pending, confirm, autoConfirm, estimate, APPROVAL_MINUTES };
