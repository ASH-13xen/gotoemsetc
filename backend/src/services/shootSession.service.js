const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const ShootSession = require('../models/ShootSession');
const Ticket = require('../models/Ticket');
const WorkLog = require('../models/WorkLog');
const Employee = require('../models/Employee');
const User = require('../models/User');
const org = require('./orgHierarchy.service');
const pipe = require('../utils/ticketPipeline');
const { istInstant } = require('../utils/istDate');
const { TICKET_STATUS, TICKET_EVENT: EV, WEEKLY_EVENT_CATEGORY } = require('../config/constants');

// Shoots. The Content Manager (or the videographer, Team Lead, CEO, admin)
// blocks a day and picks the reels from the shoot lineup — any clients'. The
// reels leave the lineup ("Shoot planned", blue) and wait for the day; the
// day is blocked on the Weekly Calendar for everyone on it. Once it's done:
// the reels shot move to "Shot" and each person's hours on the shoot are
// shared across them by weight (equal unless the Content Manager says
// otherwise) — so a two-client shoot costs both clients; a reel not shot goes
// back to the shoot lineup with the reason. Cancelling sends them all back.

const idOf = org.idOf;
const ticketService = () => require('./ticket.service');
const nameOf = (e) => (e ? `${e.firstName} ${e.lastName || ''}`.trim() : null);
const fmtDay = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const startOf = (s) => {
  const [y, m, d] = s.day.split('-').map(Number);
  return istInstant(y, m, d, Math.floor(s.startMin / 60), s.startMin % 60);
};

// May plan / complete the shoot of these reels: their Content Manager or
// videographer, the Team Lead, the CEO or admin.
function mayRun(user, tickets, chart) {
  const me = idOf(user.employeeLink);
  return tickets.every((t) => ticketService().managesTicket(user, t, chart) || (me && idOf(t.assignments?.shooter) === me));
}

async function load(id) {
  const s = await ShootSession.findById(id);
  if (!s) throw ApiError.notFound('Shoot not found');
  return s;
}

// Each person's hours on the shoot: the CEO and admin see everyone's, anyone
// else only their own.
async function shape(s, user) {
  const tickets = await Ticket.find({ _id: { $in: s.reels.map((r) => r.ticket) } }).select('number title clientName stage pipeline').lean();
  const people = await Employee.find({ _id: { $in: [...s.people, ...s.hours.map((h) => h.employee)] } }).select('firstName lastName').lean();
  const tmap = new Map(tickets.map((t) => [idOf(t._id), t]));
  return {
    _id: idOf(s._id),
    day: s.day,
    startMin: s.startMin,
    endMin: s.endMin,
    location: s.location || '',
    note: s.note || '',
    status: s.status,
    people: s.people.map((p) => ({ _id: idOf(p), name: nameOf(people.find((x) => idOf(x._id) === idOf(p))) })),
    reels: s.reels.map((r) => {
      const t = tmap.get(idOf(r.ticket));
      return {
        ticket: idOf(r.ticket),
        code: t ? ticketService().codeOf(t.number) : '',
        title: t?.title || '',
        clientName: t?.clientName || '',
        stageLabel: t ? pipe.stepLabel(t, t.stage) : '',
        weight: r.weight,
        status: r.status,
        reason: r.reason || '',
      };
    }),
    hours: s.hours
      .filter((h) => org.seesEveryone(user) || (user?.employeeLink && idOf(h.employee) === idOf(user.employeeLink)))
      .map((h) => ({ employee: idOf(h.employee), name: nameOf(people.find((x) => idOf(x._id) === idOf(h.employee))), minutes: h.minutes })),
    weeklyEvent: s.weeklyEvent ? idOf(s.weeklyEvent) : null,
    doneAt: s.doneAt || null,
    cancelledAt: s.cancelledAt || null,
    cancelReason: s.cancelReason || '',
  };
}

function checkTime(day, startMin, endMin) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) throw ApiError.badRequest('Choose the shoot date');
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin) || startMin < 0 || endMin > 24 * 60 || endMin <= startMin) throw ApiError.badRequest('Choose the shoot’s start and end time');
}

// Block the day on the Weekly Calendar for everyone on the shoot.
async function blockCalendar(user, s, tickets) {
  const users = await User.find({ employeeLink: { $in: s.people }, isActive: true }).select('_id').lean();
  const clients = [...new Set(tickets.map((t) => t.clientName).filter(Boolean))];
  try {
    const weekly = require('./weeklyCalendar.service');
    const out = await weekly.createEvent(user, {
      title: `Shoot${clients.length ? ` — ${clients.join(', ')}` : ''}`,
      description: `${tickets.length} reel${tickets.length === 1 ? '' : 's'}: ${tickets.map((t) => t.title).join('; ')}`.slice(0, 1900),
      category: WEEKLY_EVENT_CATEGORY.CLIENT,
      location: s.location,
      slots: [{ day: s.day, startMin: s.startMin, endMin: s.endMin }],
      invitees: users.map((u) => idOf(u._id)).filter((id) => id !== idOf(user.id)),
    });
    return out.events?.[0]?._id || null;
  } catch (err) {
    // A clash on someone's calendar stops the plan — they choose another time.
    if (err.statusCode === 409 || err.status === 409) throw err;
    logger.warn({ err: err.message }, 'Shoot calendar block failed');
    return null;
  }
}

// ---------------------------------------------------------------- planning

async function create(user, { day, startMin, endMin, location, note, people = [], ticketIds = [], weights = {} } = {}) {
  checkTime(day, startMin, endMin);
  if (!ticketIds.length) throw ApiError.badRequest('Choose the reels for this shoot');
  const chart = await org.loadChart();
  const tickets = await Ticket.find({ _id: { $in: ticketIds } });
  if (tickets.length !== ticketIds.length) throw ApiError.badRequest('Some of those reels were not found');
  const tsvc = ticketService();
  for (const t of tickets) {
    if (t.pipeline !== 'reel_v2') throw ApiError.badRequest(`${t.title} isn't a reel`);
    if (t.status !== TICKET_STATUS.OPEN || tsvc.parkedNow(t) !== 'shoot') throw ApiError.badRequest(`${t.title} isn't waiting in the shoot lineup`);
  }
  if (!mayRun(user, tickets, chart)) throw ApiError.forbidden('Only the reels’ Content Manager or videographer, the Team Lead, the CEO or admin plan a shoot');
  // Everyone on it: the people chosen, plus each reel's videographer.
  const crew = [...new Set([...people.map(idOf), ...tickets.map((t) => idOf(t.assignments?.shooter)).filter(Boolean)])];
  const s = new ShootSession({
    day,
    startMin,
    endMin,
    location: location?.trim(),
    note: note?.trim(),
    people: crew,
    reels: tickets.map((t) => ({ ticket: t._id, weight: Number(weights[idOf(t._id)]) >= 0 ? Number(weights[idOf(t._id)]) : 1 })),
    createdBy: user.id,
  });
  s.weeklyEvent = await blockCalendar(user, s, tickets);
  await s.save();
  const at = startOf(s);
  for (const t of tickets) {
    // eslint-disable-next-line no-await-in-loop
    await tsvc.moveByShoot(user, t, { toStage: 'shoot_planned', parkedIn: 'shoot_day', parkedUntil: at, note: `Shoot on ${fmtDay(day)}${location ? ` at ${location}` : ''}`, meta: { shoot: idOf(s._id) } });
  }
  return shape(s, user);
}

async function list(user, { from, to, status } = {}) {
  const filter = {};
  if (from || to) filter.day = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  if (status) filter.status = status;
  const sessions = await ShootSession.find(filter).sort({ day: 1, startMin: 1 }).limit(200);
  const chart = await org.loadChart();
  const me = idOf(user.employeeLink);
  const out = [];
  for (const s of sessions) {
    // eslint-disable-next-line no-await-in-loop
    const tickets = await Ticket.find({ _id: { $in: s.reels.map((r) => r.ticket) } });
    const involved = s.people.map(idOf).includes(me) || tickets.some((t) => ticketService().managesTicket(user, t, chart));
    // eslint-disable-next-line no-await-in-loop
    if (involved) out.push(await shape(s, user));
  }
  return out;
}

// ---------------------------------------------------------------- the day itself

// Done: which reels were shot (the rest go back to the lineup with a
// reason), and each person's hours — shared across the shot reels by weight.
async function complete(user, id, { shot = [], notShot = [], hours = [], weights = {} } = {}) {
  const s = await load(id);
  if (s.status !== 'planned') throw ApiError.conflict('This shoot is already done or cancelled');
  const chart = await org.loadChart();
  const tickets = await Ticket.find({ _id: { $in: s.reels.map((r) => r.ticket) } });
  if (!mayRun(user, tickets, chart) && !s.people.map(idOf).includes(idOf(user.employeeLink))) throw ApiError.forbidden('Only the people on the shoot or its managers close it');
  const shotIds = new Set(shot.map(idOf));
  const notShotMap = new Map(notShot.map((n) => [idOf(n.ticket), String(n.reason || '').trim()]));
  for (const r of s.reels) {
    const k = idOf(r.ticket);
    if (!shotIds.has(k) && !notShotMap.get(k)) throw ApiError.badRequest('For each reel, say it was shot or why it wasn’t');
    if (weights[k] !== undefined) {
      const w = Number(weights[k]);
      if (!Number.isFinite(w) || w < 0) throw ApiError.badRequest('Each reel’s share is a number, 0 or more');
      r.weight = w;
    }
  }
  const crew = new Set(s.people.map(idOf));
  const entered = hours.length ? hours : s.people.map((p) => ({ employee: p, minutes: s.endMin - s.startMin }));
  for (const h of entered) {
    const m = Math.round(Number(h.minutes));
    if (!crew.has(idOf(h.employee))) throw ApiError.badRequest('Hours can only be for the people on the shoot');
    if (!Number.isFinite(m) || m < 0 || m > 24 * 60) throw ApiError.badRequest('Hours on the shoot: minutes, 0 to a full day');
  }

  const tsvc = ticketService();
  const now = new Date();
  const shotReels = s.reels.filter((r) => shotIds.has(idOf(r.ticket)));
  const totalWeight = shotReels.reduce((t, r) => t + r.weight, 0) || shotReels.length;
  for (const r of s.reels) {
    const t = tickets.find((x) => idOf(x._id) === idOf(r.ticket));
    if (!t) continue;
    if (shotIds.has(idOf(r.ticket))) {
      r.status = 'shot';
      // eslint-disable-next-line no-await-in-loop
      await tsvc.moveByShoot(user, t, { toStage: 'shot', parkedIn: null, parkedUntil: null, note: `Shot on ${fmtDay(s.day)}`, meta: { shoot: idOf(s._id) } });
    } else {
      r.status = 'not_shot';
      r.reason = notShotMap.get(idOf(r.ticket));
      // eslint-disable-next-line no-await-in-loop
      await tsvc.moveByShoot(user, t, { toStage: 'script_approved', parkedIn: 'shoot', parkedUntil: null, note: `Not shot on ${fmtDay(s.day)}: ${r.reason} — back in the shoot lineup`, meta: { shoot: idOf(s._id) } });
    }
  }
  // The shoot's hours, shared across the reels shot.
  const [y, mo, d] = s.day.split('-').map(Number);
  const from = istInstant(y, mo, d, Math.floor(s.startMin / 60), s.startMin % 60);
  const to = istInstant(y, mo, d, Math.floor(s.endMin / 60), s.endMin % 60);
  for (const h of entered) {
    const total = Math.round(Number(h.minutes));
    for (const r of shotReels) {
      const t = tickets.find((x) => idOf(x._id) === idOf(r.ticket));
      const share = Math.round((total * (totalWeight ? r.weight : 1)) / (totalWeight || shotReels.length));
      // eslint-disable-next-line no-await-in-loop
      await WorkLog.create({
        employee: h.employee,
        user: user.id,
        kind: 'ticket',
        ticket: r.ticket,
        client: t?.client || null,
        step: 'shot',
        startedAt: from,
        endedAt: to,
        minutes: share,
        source: 'shoot',
        shoot: s._id,
        confirmedAt: now,
        note: `Share of ${Math.floor(total / 60)} h ${total % 60} min on the shoot (${shotReels.length} reel${shotReels.length === 1 ? '' : 's'})`,
      });
    }
  }
  s.hours = entered.map((h) => ({ employee: h.employee, minutes: Math.round(Number(h.minutes)) }));
  s.status = 'done';
  s.doneAt = now;
  s.doneBy = user.id;
  await s.save();
  return shape(s, user);
}

async function cancel(user, id, { reason } = {}) {
  const s = await load(id);
  if (s.status !== 'planned') throw ApiError.conflict('This shoot is already done or cancelled');
  if (!String(reason || '').trim()) throw ApiError.badRequest('Say why the shoot is cancelled');
  const chart = await org.loadChart();
  const tickets = await Ticket.find({ _id: { $in: s.reels.map((r) => r.ticket) } });
  if (!mayRun(user, tickets, chart)) throw ApiError.forbidden('Only the reels’ Content Manager or videographer, the Team Lead, the CEO or admin cancel a shoot');
  for (const t of tickets) {
    if (t.status !== TICKET_STATUS.OPEN || t.stage !== 'shoot_planned') continue;
    // eslint-disable-next-line no-await-in-loop
    await ticketService().moveByShoot(user, t, { toStage: 'script_approved', parkedIn: 'shoot', parkedUntil: null, note: `Shoot on ${fmtDay(s.day)} cancelled: ${reason.trim()} — back in the shoot lineup` });
  }
  s.reels.forEach((r) => {
    if (r.status === 'planned') r.status = 'removed';
  });
  s.status = 'cancelled';
  s.cancelledAt = new Date();
  s.cancelReason = reason.trim();
  await s.save();
  if (s.weeklyEvent) {
    // The shoot owns its calendar block: whoever may cancel the shoot frees
    // the time — as the block's host (whoever planned it) when it isn't them.
    const weekly = require('./weeklyCalendar.service');
    const why = { reason: `Shoot cancelled: ${reason.trim()}` };
    try {
      await weekly.cancelEvent(user, idOf(s.weeklyEvent), why);
    } catch (err) {
      try {
        if (err.statusCode !== 403 && err.status !== 403) throw err;
        const ev = await require('../models/WeeklyEvent').findById(s.weeklyEvent).select('host').lean();
        const host = ev ? await require('./access.service').resolveUser(idOf(ev.host)) : null;
        if (!host) throw err;
        await weekly.cancelEvent(host, idOf(s.weeklyEvent), why);
      } catch (again) {
        logger.warn({ err: again.message }, 'Cancelling the shoot’s calendar block failed');
      }
    }
  }
  return shape(s, user);
}

module.exports = { create, list, complete, cancel, get: async (user, id) => shape(await load(id), user) };
