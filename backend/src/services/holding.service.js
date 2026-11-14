const Ticket = require('../models/Ticket');
const TicketEvent = require('../models/TicketEvent');
const Employee = require('../models/Employee');
const Holiday = require('../models/Holiday');
const AttendanceRecord = require('../models/AttendanceRecord');
const org = require('./orgHierarchy.service');
const pipe = require('../utils/ticketPipeline');
const cw = require('../utils/clientWork');
const { istInstant, istParts } = require('../utils/istDate');
const { TICKET_EVENT: EV, ATTENDANCE_STATUS: AS } = require('../config/constants');

// Who was holding which ticket, minute by minute — the estimate of time worked
// a person confirms when they hand a step on (ticketHours.service.js), and the
// report's automatic estimate beside the hours people confirmed
// (clientValue.service.js).
//
// A person holds a ticket while its next step waits on them by name — not
// while it is locked, waiting in a lineup, on hold or scheduled for a later
// posting date, and never at an approval (a check, counted as a short
// review) or a step the Team Lead / CEO pool acts on. Only working time
// counts: the person's shift minus lunch, on working days, not on a day of
// leave, absence or holiday (a half day counts the morning). Each minute is
// shared equally among the tickets they held at that minute.

const idOf = org.idOf;
const MIN = 60000;
const OFF = new Set([AS.PAID_LEAVE, AS.ABSENT, AS.HOLIDAY]);

// The person(s) a step waits on by name, when it is held work.
function holderIdsFor(ticket, step, chart) {
  const a = step?.actor;
  if (!a || step.approval) return [];
  const one = (id) => (id ? [idOf(id)] : []);
  switch (a.type) {
    case 'raised_for':
      return one(ticket.raisedFor);
    case 'raiser':
      return one(ticket.raisedByEmployee);
    case 'direct':
      return one((ticket.customSteps || []).find((s) => s.key === a.stepKey)?.assignee);
    case 'assignment':
      return one(ticket.assignments?.[a.field] || (a.field === 'smm' ? ticket.smm : null));
    case 'approver':
      return one(ticket.approver || ticket.raisedByEmployee);
    case 'planner':
      // The team's Content Manager writes the plan; the Team Lead and CEO only
      // when they do it themselves (then they confirm it at handover).
      return [...new Set([...(ticket.assignments?.contentManager ? [idOf(ticket.assignments.contentManager)] : []), ...(ticket.team ? org.roleHolders(chart, ticket.team, org.TEAM_ROLE.CONTENT_MANAGER) : [])])].slice(0, 1);
    case 'team_role':
      if (a.role === org.TEAM_ROLE.SOCIAL_MEDIA_MANAGER && ticket.smm) return one(ticket.smm);
      return ticket.team ? org.roleHolders(chart, ticket.team, a.role) : [];
    default:
      return []; // tl_ceo, global_team_lead, smm_or_lead — the top of the chart, not held
  }
}

// A ticket's life as [from, to, state] pieces, from its record.
function pieces(ticket, events, until) {
  const out = [];
  const startedAt = events.find((e) => e.type === EV.STARTED)?.at;
  let state = { stage: 'created', locked: Boolean(ticket.locked) || Boolean(startedAt), parked: null, until: null };
  let t = new Date(ticket.createdAt).getTime();
  let open = true;
  for (const e of events) {
    const at = new Date(e.at).getTime();
    if (at > t) out.push([t, at, { ...state }]);
    t = Math.max(t, at);
    if (e.type === EV.STARTED) state.locked = false;
    else if ([EV.ADVANCED, EV.RESTARTED, EV.SENT_BACK].includes(e.type) && e.toStage) state = { ...state, stage: e.toStage, parked: null, until: null };
    else if (e.type === EV.PARKED) state = { ...state, parked: e.meta?.lineup || 'lineup', until: e.meta?.until ? new Date(e.meta.until).getTime() : null };
    else if (e.type === EV.UNPARKED) state = { ...state, parked: null, until: null };
    else if (e.type === EV.REJECTED || e.type === EV.COMPLETED) {
      open = false;
      break;
    }
  }
  if (open && until > t) out.push([t, until, { ...state }]);
  // A ticket parked until a date (posting, shoot day) is held again from it.
  const split = [];
  for (const [a, b, s] of out) {
    if (s.parked && s.until && s.until < b) {
      if (s.until > a) split.push([a, s.until, s]);
      split.push([Math.max(a, s.until), b, { ...s, parked: null }]);
    } else split.push([a, b, s]);
  }
  return split;
}

// The working windows of a person's day, as [from, to] instants.
function windowsOf(employee, year, month, day, status) {
  if (OFF.has(status)) return [];
  const s = cw.hm(employee?.workingHoursStart, cw.DEFAULT_SHIFT.start);
  const e = cw.hm(employee?.workingHoursEnd, cw.DEFAULT_SHIFT.end);
  const at = (h) => istInstant(year, month, day, h.hour, h.minute).getTime();
  const w = [
    [at(s), at(cw.LUNCH.start)],
    [at(cw.LUNCH.end), at(e)],
  ].filter(([a, b]) => b > a);
  return status === AS.HALF_DAY ? w.slice(0, 1) : w;
}

const dayKeyUTC = (d) => new Date(d).toISOString().slice(0, 10);

// Map(employee → Map(ticketId → minutes)) for [from, to]. `employeeIds`
// limits it to some people (and to the tickets they could hold).
async function holdingFor({ employeeIds = null, from, to, chart: givenChart = null }) {
  const chart = givenChart || (await org.loadChart());
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  const result = new Map();
  if (end <= start) return { minutes: result, tickets: new Map() };

  const alive = {
    createdAt: { $lt: new Date(end) },
    'deliverable.removed': { $ne: true },
    $or: [{ status: 'open' }, { completedAt: { $gte: new Date(start) } }, { rejectedAt: { $gte: new Date(start) } }],
  };
  let filter = alive;
  if (employeeIds) {
    const ids = [...employeeIds];
    const teamsAsCm = chart.nodes
      .filter((n) => n.teamRole === org.TEAM_ROLE.CONTENT_MANAGER && (n.assignees || []).map(idOf).some((x) => ids.includes(x)))
      .map((n) => {
        let p = chart.byId.get(idOf(n.parent));
        while (p && p.kind !== 'team') p = chart.byId.get(idOf(p.parent));
        return p?._id;
      })
      .filter(Boolean);
    filter = {
      $and: [
        alive,
        {
          $or: [
            { raisedFor: { $in: ids } },
            { raisedByEmployee: { $in: ids } },
            { approver: { $in: ids } },
            { smm: { $in: ids } },
            { 'assignments.designer': { $in: ids } },
            { 'assignments.shooter': { $in: ids } },
            { 'assignments.editor': { $in: ids } },
            { 'assignments.contentManager': { $in: ids } },
            { 'assignments.smm': { $in: ids } },
            { 'customSteps.assignee': { $in: ids } },
            ...(teamsAsCm.length ? [{ team: { $in: teamsAsCm } }] : []),
          ],
        },
      ],
    };
  }
  const tickets = await Ticket.find(filter).lean();
  const ticketMap = new Map(tickets.map((t) => [idOf(t._id), t]));
  if (!tickets.length) return { minutes: result, tickets: ticketMap };
  const events = await TicketEvent.find({
    ticket: { $in: tickets.map((t) => t._id) },
    type: { $in: [EV.STARTED, EV.ADVANCED, EV.RESTARTED, EV.SENT_BACK, EV.PARKED, EV.UNPARKED, EV.REJECTED, EV.COMPLETED] },
  })
    .sort({ at: 1, _id: 1 })
    .select('ticket type at toStage meta')
    .lean();
  const byTicket = new Map();
  for (const e of events) {
    const k = idOf(e.ticket);
    if (!byTicket.has(k)) byTicket.set(k, []);
    byTicket.get(k).push(e);
  }

  // Held stretches per person.
  const held = new Map(); // employee → [{ ticket, a, b }]
  const holderCache = new Map();
  for (const t of tickets) {
    for (const [a0, b0, s] of pieces(t, byTicket.get(idOf(t._id)) || [], end)) {
      if (s.locked || s.parked) continue;
      const a = Math.max(a0, start);
      const b = Math.min(b0, end);
      if (b <= a) continue;
      const ck = `${idOf(t._id)}|${s.stage}`;
      if (!holderCache.has(ck)) {
        const view = { ...t, stage: s.stage };
        holderCache.set(ck, holderIdsFor(view, pipe.nextStep(view), chart));
      }
      for (const emp of holderCache.get(ck)) {
        if (employeeIds && !employeeIds.has(emp)) continue;
        if (!held.has(emp)) held.set(emp, []);
        held.get(emp).push({ ticket: idOf(t._id), a, b });
      }
    }
  }
  if (!held.size) return { minutes: result, tickets: ticketMap };

  // Their working windows.
  const people = new Map((await Employee.find({ _id: { $in: [...held.keys()] } }).select('workingHoursStart workingHoursEnd').lean()).map((e) => [idOf(e._id), e]));
  const holidays = new Set(
    (await Holiday.find({ type: 'holiday', date: { $gte: new Date(start - 86400000), $lte: new Date(end + 86400000) } }).select('date').lean()).map((h) => dayKeyUTC(h.date))
  );
  const statuses = new Map(
    (
      await AttendanceRecord.find({ employee: { $in: [...held.keys()] }, date: { $gte: new Date(start - 86400000), $lte: new Date(end + 86400000) } })
        .select('employee date status')
        .lean()
    ).map((r) => [`${idOf(r.employee)}|${dayKeyUTC(r.date)}`, r.status])
  );

  for (const [emp, stretches] of held) {
    const minutes = new Map();
    // Day by day across the period.
    const first = istParts(new Date(start));
    let cursor = istInstant(first.year, first.month, first.day).getTime();
    while (cursor < end) {
      const p = istParts(new Date(cursor));
      const key = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
      const workday = p.weekday !== 0 && !holidays.has(key);
      const windows = workday ? windowsOf(people.get(emp), p.year, p.month, p.day, statuses.get(`${emp}|${key}`)) : [];
      for (const [w0, w1] of windows) {
        const segs = stretches.map((x) => ({ t: x.ticket, a: Math.max(x.a, w0, start), b: Math.min(x.b, w1, end) })).filter((x) => x.b > x.a);
        if (!segs.length) continue;
        const cuts = [...new Set(segs.flatMap((x) => [x.a, x.b]))].sort((x, y) => x - y);
        for (let i = 0; i < cuts.length - 1; i += 1) {
          const on = segs.filter((x) => x.a <= cuts[i] && x.b >= cuts[i + 1]);
          if (!on.length) continue;
          const share = (cuts[i + 1] - cuts[i]) / MIN / on.length;
          for (const x of on) minutes.set(x.t, (minutes.get(x.t) || 0) + share);
        }
      }
      cursor = istInstant(p.year, p.month, p.day + 1).getTime();
    }
    result.set(emp, minutes);
  }
  return { minutes: result, tickets: ticketMap };
}

module.exports = { holdingFor, holderIdsFor, pieces };
