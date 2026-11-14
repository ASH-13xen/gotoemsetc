const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const Ticket = require('../models/Ticket');
const TaskClient = require('../models/TaskClient');
const ClientMonth = require('../models/ClientMonth');
const WorkLog = require('../models/WorkLog');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const ticketService = require('./ticket.service');
const notificationService = require('./notification.service');
const notifyRecipients = require('./notifyRecipients.service');
const org = require('./orgHierarchy.service');
const { can } = require('../utils/roles');
const { ACCESS } = require('../config/access');
const { istMonthRange, istParts } = require('../utils/istDate');
const { TICKET_STATUS, TICKET_EVENT: EV, NOTIFICATION_TYPES: NT, USER_ROLES } = require('../config/constants');
const cw = require('../utils/clientWork');

// Client work: each client's month — how many reels, posts, stories and
// festive stories it is owed, and the team that makes them — and the tickets
// made from it, one per deliverable, already on their pipeline with their
// people. Raising a count adds tickets; lowering it takes off ones nobody has
// started. On the 1st, each client's month starts as a copy of the last one,
// and anything still open from an earlier month is carried over, flagged.

const idOf = org.idOf;
const nameOf = (e) => (e ? `${e.firstName} ${e.lastName || ''}`.trim() : null);

// Who may set the counts and the people: CEO, admin and HR. The client's fee
// and the money side: CEO and admin.
const { hasRole } = require('../utils/roles');
const canPlan = (user) => org.seesEveryone(user) || can(user, ACCESS.HRMS) || hasRole(user, USER_ROLES.TEAM_LEAD);
const picksFromAnyTeam = (user) => org.seesEveryone(user) || hasRole(user, USER_ROLES.TEAM_LEAD);
const canSeeMoney = (user) => can(user, ACCESS.PAYOUT_APPROVAL);

function checkMonth(key) {
  if (!cw.parseMonth(key)) throw ApiError.badRequest('Choose a month');
  return key;
}

async function loadClient(id) {
  const client = await TaskClient.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

const countsOf = (cm) => Object.fromEntries(cw.CONTENT_TYPE_KEYS.map((k) => [k, cm?.counts?.[k] || 0]));
const isActive = (t) => !t.deliverable?.removed;

// ---------------------------------------------------------------- the cards

// Every client with its month: what is committed, how many tickets are made
// and done per type, what is carried over from before, and the time logged.
async function cards(user, { month } = {}) {
  const key = checkMonth(month || cw.currentMonthKey());
  const { year, month: m } = cw.parseMonth(key);
  const range = istMonthRange(year, m);
  const [clients, months, tickets, carried, logged] = await Promise.all([
    TaskClient.find({ isDeleted: { $ne: true } }).select('name brandName logoUrl workPaused').sort({ name: 1 }).lean(),
    ClientMonth.find({ month: key }).lean(),
    Ticket.find({ 'deliverable.month': key }).select('client deliverable status isRejected locked').lean(),
    Ticket.find({ carriedOver: true, status: TICKET_STATUS.OPEN }).select('client deliverable').lean(),
    WorkLog.aggregate([
      { $match: { deleted: false, superseded: { $ne: true }, client: { $ne: null }, startedAt: { $gte: range.start, $lt: range.end } } },
      { $group: { _id: '$client', minutes: { $sum: '$minutes' } } },
    ]),
  ]);
  const teamIds = months.map((x) => x.team).filter(Boolean);
  const chart = teamIds.length ? await org.loadChart() : null;
  const people = await Employee.find({ _id: { $in: months.flatMap((x) => [x.smm]).filter(Boolean) } }).select('firstName lastName').lean();
  const personName = (id) => nameOf(people.find((p) => idOf(p._id) === idOf(id)));
  const money = canSeeMoney(user);
  const invoices = money ? await Invoice.find({ year, month: m }).select('client amount').lean() : [];

  return {
    month: key,
    monthLabel: cw.monthLabel(key),
    types: cw.CONTENT_TYPES,
    canPlan: canPlan(user),
    canSeeMoney: money,
    cards: clients.map((c) => {
      const cm = months.find((x) => idOf(x.client) === idOf(c._id));
      const mine = tickets.filter((t) => idOf(t.client) === idOf(c._id) && isActive(t));
      const progress = Object.fromEntries(
        cw.CONTENT_TYPE_KEYS.map((k) => {
          const of = mine.filter((t) => t.deliverable.type === k);
          return [k, { committed: cm?.counts?.[k] || 0, made: of.length, toStart: of.filter((t) => t.locked && t.status === TICKET_STATUS.OPEN).length, done: of.filter((t) => t.status === TICKET_STATUS.COMPLETED).length }];
        })
      );
      const inv = invoices.find((i) => idOf(i.client) === idOf(c._id));
      return {
        client: { _id: idOf(c._id), name: c.name, brandName: c.brandName || '', logoUrl: c.logoUrl || '', workPaused: Boolean(c.workPaused) },
        planned: Boolean(cm),
        team: cm?.team ? { _id: idOf(cm.team), title: cm.teamName || chart?.byId.get(idOf(cm.team))?.title || '' } : null,
        smm: cm?.smm ? { _id: idOf(cm.smm), name: personName(cm.smm) } : null,
        generatedAt: cm?.generatedAt || null,
        progress,
        carriedOver: carried.filter((t) => idOf(t.client) === idOf(c._id)).length,
        hoursLogged: Math.round(((logged.find((l) => idOf(l._id) === idOf(c._id))?.minutes || 0) / 60) * 10) / 10,
        ...(money ? { revenue: inv ? { amount: inv.amount, source: 'invoice' } : cm?.fee != null ? { amount: cm.fee, source: 'fee' } : null } : {}),
      };
    }),
  };
}

// ---------------------------------------------------------------- one client's month

async function detail(user, clientId, month) {
  const key = checkMonth(month);
  const client = await loadClient(clientId);
  const { year, month: m } = cw.parseMonth(key);
  let cm = await ClientMonth.findOne({ client: client._id, month: key }).lean();
  // Not set yet: offer the last month's plan to start from.
  let suggested = null;
  if (!cm) {
    suggested = await ClientMonth.findOne({ client: client._id, month: { $lt: key } }).sort({ month: -1 }).lean();
  }
  const tickets = cm ? await Ticket.find({ 'deliverable.clientMonth': cm._id }).sort({ 'deliverable.type': 1, 'deliverable.index': 1 }).lean() : [];
  const carried = await Ticket.find({ client: client._id, carriedOver: true, status: TICKET_STATUS.OPEN, 'deliverable.month': { $lt: key } }).sort({ dueAt: 1 }).lean();
  const all = [...tickets, ...carried];
  const minutes = all.length
    ? await WorkLog.aggregate([
        { $match: { deleted: false, superseded: { $ne: true }, ticket: { $in: all.map((t) => t._id) } } },
        { $group: { _id: '$ticket', minutes: { $sum: '$minutes' } } },
      ])
    : [];
  const src = cm || suggested;
  const peopleIds = src ? [src.smm, src.designer, src.shooter, src.editor, src.contentManager].filter(Boolean) : [];
  const people = await Employee.find({ _id: { $in: peopleIds } }).select('firstName lastName').lean();
  const person = (id) => (id ? { _id: idOf(id), name: nameOf(people.find((p) => idOf(p._id) === idOf(id))) } : null);
  const money = canSeeMoney(user);
  const invoice = money ? await Invoice.findOne({ client: client._id, year, month: m }).select('amount status invoiceNumber').lean() : null;
  const pipe = require('../utils/ticketPipeline');
  const now = new Date();
  const shape = (t) => ({
    _id: idOf(t._id),
    code: ticketService.codeOf(t.number),
    title: t.title,
    type: t.deliverable?.type,
    index: t.deliverable?.index,
    month: t.deliverable?.month,
    dueAt: t.dueAt,
    status: t.status,
    removed: Boolean(t.deliverable?.removed),
    locked: Boolean(t.locked),
    parkedIn: t.parkedIn || null,
    carriedOver: Boolean(t.carriedOver),
    stageLabel: pipe.stepLabel(t, t.stage),
    color: pipe.colorFor(t, now),
    minutes: minutes.find((x) => idOf(x._id) === idOf(t._id))?.minutes || 0,
  });

  return {
    client: { _id: idOf(client._id), name: client.name, workPaused: Boolean(client.workPaused) },
    month: key,
    monthLabel: cw.monthLabel(key),
    canPlan: canPlan(user),
    canSeeMoney: money,
    types: cw.CONTENT_TYPES,
    plan: src
      ? {
          fromMonth: src.month,
          isSuggestion: !cm,
          counts: countsOf(src),
          team: src.team ? idOf(src.team) : null,
          teamName: src.teamName || '',
          smm: person(src.smm),
          designer: person(src.designer),
          shooter: person(src.shooter),
          editor: person(src.editor),
          contentManager: person(src.contentManager),
          ...(money ? { fee: cm ? cm.fee : null } : {}),
          generatedAt: cm?.generatedAt || null,
        }
      : null,
    ...(money ? { invoice: invoice ? { amount: invoice.amount, status: invoice.status, number: invoice.invoiceNumber } : null } : {}),
    tickets: tickets.map(shape),
    carriedOver: carried.map(shape),
  };
}

// ---------------------------------------------------------------- saving + tickets

const COUNT_MAX = 200;

async function saveMonth(user, clientId, month, input = {}) {
  if (!canPlan(user)) throw ApiError.forbidden('Only HR, the CEO and admin set a client’s monthly plan');
  const key = checkMonth(month);
  const client = await loadClient(clientId);
  const chart = await org.loadChart();
  const counts = {};
  for (const k of cw.CONTENT_TYPE_KEYS) {
    const n = Number(input.counts?.[k] ?? 0);
    if (!Number.isInteger(n) || n < 0 || n > COUNT_MAX) throw ApiError.badRequest(`${cw.typeOf(k).plural}: a whole number from 0 to ${COUNT_MAX}`);
    counts[k] = n;
  }
  const team = input.team ? chart.byId.get(idOf(input.team)) : null;
  if (input.team && (!team || team.kind !== 'team')) throw ApiError.badRequest('Choose the team from the Organisation chart');
  const holders = (role) => (team ? org.roleHolders(chart, team._id, role) : []);
  const members = team ? org.teamMembers(chart, team._id) : [];
  // The team's Content Manager picks from the team; the Team Lead, CEO and admin from anyone.
  for (const f of ['smm', 'designer', 'shooter', 'editor', 'contentManager']) {
    if (input[f] && team && !picksFromAnyTeam(user) && !members.includes(idOf(input[f]))) throw ApiError.badRequest(`Choose people from ${team.title}`);
  }
  const smm = input.smm || holders(org.TEAM_ROLE.SOCIAL_MEDIA_MANAGER)[0] || null;
  const set = {
    counts,
    team: team ? team._id : null,
    teamName: team ? team.title : '',
    smm,
    designer: input.designer || holders(org.TEAM_ROLE.GRAPHIC_DESIGNER)[0] || smm,
    shooter: input.shooter || holders(org.TEAM_ROLE.VIDEOGRAPHER)[0] || holders(org.TEAM_ROLE.VIDEOGRAPHER_EDITOR)[0] || null,
    editor: input.editor || holders(org.TEAM_ROLE.EDITOR)[0] || holders(org.TEAM_ROLE.VIDEOGRAPHER_EDITOR)[0] || null,
    contentManager: input.contentManager || holders(org.TEAM_ROLE.CONTENT_MANAGER)[0] || (team ? org.teamHeads(chart, team._id)[0] : null) || null,
    updatedBy: user.id,
  };
  if (canSeeMoney(user) && input.fee !== undefined) {
    const fee = input.fee === null || input.fee === '' ? null : Number(input.fee);
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) throw ApiError.badRequest('The fee is an amount in rupees');
    set.fee = fee;
  }
  const cm = await ClientMonth.findOneAndUpdate(
    { client: client._id, month: key },
    { $set: set, $setOnInsert: { createdBy: user.id } },
    { upsert: true, new: true }
  );
  // A month that has started gets its tickets now; a later one on its 1st.
  let result = null;
  if (key <= cw.currentMonthKey() || input.generate) result = await sync(user, cm, { client, chart });
  return { ...(await detail(user, client._id, key)), result };
}

// Makes the month's tickets match its counts.
async function sync(user, cm, { client: givenClient = null, chart: givenChart = null, notify = true } = {}) {
  const client = givenClient || (await loadClient(cm.client));
  const chart = givenChart || (await org.loadChart());
  const counts = countsOf(cm);
  const anything = Object.values(counts).some((n) => n > 0);
  if (anything && (!cm.team || !cm.smm)) throw ApiError.badRequest('Choose the team and its Social Media Manager first');
  if (anything && !cm.contentManager) throw ApiError.badRequest('Choose the Content Manager');
  if (counts.reels > 0 && (!cm.shooter || !cm.editor)) throw ApiError.badRequest('Reels need their videographer and video editor');

  const existing = await Ticket.find({ 'deliverable.clientMonth': cm._id }).lean();
  const now = new Date();
  const today = istParts(now);
  const { year, month } = cw.parseMonth(cm.month);
  const fromDay = today.year === year && today.month === month ? today.day : 1;
  const created = [];
  const removed = [];

  // Taking off first, so a lowered count fails before anything is made.
  for (const type of cw.CONTENT_TYPES) {
    const active = existing.filter((t) => t.deliverable.type === type.key && isActive(t));
    const extra = active.length - counts[type.key];
    if (extra <= 0) continue;
    const worked = await WorkLog.distinct('ticket', { ticket: { $in: active.map((t) => t._id) }, deleted: false, minutes: { $gt: 0 } });
    const workedIds = new Set(worked.map(idOf));
    // Not started first, then started but untouched; never one with work on it.
    const untouched = active
      .filter((t) => t.status === TICKET_STATUS.OPEN && t.stage === 'created' && !t.isSentBack && !workedIds.has(idOf(t._id)))
      .sort((a, b) => Number(b.locked) - Number(a.locked) || b.deliverable.index - a.deliverable.index);
    if (untouched.length < extra) {
      throw ApiError.conflict(
        `${type.plural}: only ${untouched.length} of the ${active.length} can be taken off — the others have been started. Lower the count by at most ${untouched.length}.`
      );
    }
    for (const t of untouched.slice(0, extra)) {
      // eslint-disable-next-line no-await-in-loop
      await Ticket.updateOne(
        { _id: t._id },
        { $set: { status: TICKET_STATUS.REJECTED, isRejected: true, rejectedAt: now, 'deliverable.removed': true } }
      );
      // eslint-disable-next-line no-await-in-loop
      await ticketService.record(t, EV.REJECTED, user, {
        fromStage: t.stage,
        toStage: t.stage,
        note: `Taken off ${client.name}'s ${cw.monthLabel(cm.month)} plan — ${type.plural.toLowerCase()} went from ${active.length} to ${counts[type.key]}`,
      });
      removed.push(idOf(t._id));
    }
  }

  for (const type of cw.CONTENT_TYPES) {
    const n = counts[type.key];
    const active = existing.filter((t) => t.deliverable.type === type.key && isActive(t));
    if (active.length >= n) continue;
    const used = new Set(active.map((t) => t.deliverable.index));
    const missing = [];
    for (let i = 1; missing.length < n - active.length; i += 1) if (!used.has(i)) missing.push(i);
    for (const index of missing) {
      // Its real due date is set when work is started; until then, the month's end.
      const [dueAt] = cw.spreadDueDates(cm.month, 1, { fromDay, total: 1, startIndex: 1 });
      const input = {
        title: `${client.name} · ${type.label} ${index} · ${cw.monthLabel(cm.month)}`,
        description: `From ${client.name}'s plan for ${cw.monthLabel(cm.month)}: ${n} ${type.plural.toLowerCase()}.`,
        dueAt,
        clientName: client.name,
        pipeline: type.pipeline,
        team: cm.team,
        smm: cm.smm,
        assignments: { smm: cm.smm, contentManager: cm.contentManager, designer: cm.designer || cm.smm, shooter: cm.shooter, editor: cm.editor },
      };
      // eslint-disable-next-line no-await-in-loop
      const ticket = await ticketService.raise(user, input, {
        system: true,
        quiet: true,
        bare: true,
        locked: true,
        chart,
        extra: { client: client._id, deliverable: { clientMonth: cm._id, month: cm.month, type: type.key, index } },
      });
      created.push({ _id: idOf(ticket._id), type: type.key, raisedFor: idOf(ticket.raisedFor) });
    }
  }

  await ClientMonth.updateOne({ _id: cm._id }, { $set: { generatedAt: now } });
  if (notify && created.length) await notifyMade(client, cm, created).catch((err) => logger.error({ err }, 'Client work notification failed'));
  return { created: created.length, removed: removed.length };
}

// One notification per person, not one per ticket.
async function notifyMade(client, cm, created) {
  const byPerson = new Map();
  for (const c of created) {
    if (!byPerson.has(c.raisedFor)) byPerson.set(c.raisedFor, {});
    const tally = byPerson.get(c.raisedFor);
    tally[c.type] = (tally[c.type] || 0) + 1;
  }
  for (const [employeeId, tally] of byPerson) {
    const parts = Object.entries(tally).map(([k, n]) => `${n} ${(n === 1 ? cw.typeOf(k).label : cw.typeOf(k).plural).toLowerCase()}`);
    // eslint-disable-next-line no-await-in-loop
    const userIds = await notifyRecipients.resolveUserIdsForEmployees([employeeId]);
    if (!userIds.length) continue;
    // eslint-disable-next-line no-await-in-loop
    await notificationService.createForUsers(userIds, {
      type: NT.CLIENT_WORK_TICKETS,
      title: `${client.name} · ${cw.monthLabel(cm.month)}: new tickets`,
      message: `${parts.join(', ')} for ${client.name} are in your tickets.`,
    });
  }
}

async function generate(user, clientId, month) {
  if (!canPlan(user)) throw ApiError.forbidden('Only HR, the CEO and admin make a client’s tickets');
  const cm = await ClientMonth.findOne({ client: clientId, month: checkMonth(month) });
  if (!cm) throw ApiError.notFound('Set this month’s plan first');
  const result = await sync(user, cm);
  return { ...(await detail(user, clientId, month)), result };
}

async function setPaused(user, clientId, paused) {
  if (!canPlan(user)) throw ApiError.forbidden('Only HR, the CEO and admin pause a client');
  const client = await loadClient(clientId);
  client.workPaused = Boolean(paused);
  await client.save();
  return { workPaused: client.workPaused };
}

// ---------------------------------------------------------------- the 1st of the month

async function systemUser() {
  const u = await User.findOne({ role: USER_ROLES.ADMIN, isActive: true }).sort({ createdAt: 1 });
  if (!u) return null;
  return { id: u._id, username: u.username, role: u.role, roles: [u.role], employeeLink: u.employeeLink || null, displayName: 'System' };
}

// Each client's new month as a copy of the last one (unless paused), then
// the tickets for every month that has started and hasn't had them made.
async function rollMonth(now = new Date()) {
  const key = cw.currentMonthKey(now);
  const prev = cw.addMonths(key, -1);
  const user = await systemUser();
  if (!user) return { started: 0, generated: 0 };
  const clients = await TaskClient.find({ isDeleted: { $ne: true }, workPaused: { $ne: true } }).select('_id').lean();
  let started = 0;
  for (const c of clients) {
    // eslint-disable-next-line no-await-in-loop
    const [have, last] = await Promise.all([ClientMonth.exists({ client: c._id, month: key }), ClientMonth.findOne({ client: c._id, month: prev }).lean()]);
    if (have || !last) continue;
    // eslint-disable-next-line no-await-in-loop
    await ClientMonth.create({
      client: c._id,
      month: key,
      counts: countsOf(last),
      team: last.team,
      teamName: last.teamName,
      smm: last.smm,
      designer: last.designer,
      shooter: last.shooter,
      editor: last.editor,
      contentManager: last.contentManager,
      fee: last.fee,
      createdBy: user.id,
    });
    started += 1;
  }
  let generated = 0;
  const due = await ClientMonth.find({ month: { $lte: key }, generatedAt: null });
  for (const cm of due) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sync(user, cm);
      generated += 1;
    } catch (err) {
      logger.warn({ err: err.message, client: idOf(cm.client), month: cm.month }, 'Client month could not make its tickets');
    }
  }
  return { started, generated };
}

// Open tickets from a month that has ended move on, flagged.
async function carryOver(now = new Date()) {
  const key = cw.currentMonthKey(now);
  const late = await Ticket.find({ 'deliverable.month': { $lt: key }, status: TICKET_STATUS.OPEN, carriedOver: false });
  for (const t of late) {
    // eslint-disable-next-line no-await-in-loop
    await Ticket.updateOne({ _id: t._id }, { $set: { carriedOver: true } });
    // eslint-disable-next-line no-await-in-loop
    await ticketService.record(t, EV.EDITED, null, { note: `Not finished in ${cw.monthLabel(t.deliverable.month)} — carried over into ${cw.monthLabel(key)}` });
  }
  return late.length;
}

module.exports = { cards, detail, saveMonth, sync, generate, setPaused, rollMonth, carryOver, canPlan, canSeeMoney };
