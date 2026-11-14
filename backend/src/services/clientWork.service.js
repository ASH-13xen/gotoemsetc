const mongoose = require('mongoose');
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
// started; more can be made by hand beyond the count ("9 of 8 reels"). A plan
// carries on month after month until it is changed: each new month starts as
// a copy of the latest one, and anything still open from an earlier month is
// carried over, flagged.

const idOf = org.idOf;
const nameOf = (e) => (e ? `${e.firstName} ${e.lastName || ''}`.trim() : null);

// Who may set the counts and the people: CEO, admin and HR. The client's fee
// and the money side: CEO and admin. Time spent (hours per client, per
// ticket): CEO and admin only.
const { hasRole } = require('../utils/roles');
const canPlan = (user) => org.seesEveryone(user) || can(user, ACCESS.HRMS) || hasRole(user, USER_ROLES.TEAM_LEAD);
// Adding a client: the CEO and admin (Client Management, where clients were
// registered, is hidden for now).
const canAddClient = (user) => org.seesEveryone(user);
const picksFromAnyTeam = (user) => org.seesEveryone(user) || hasRole(user, USER_ROLES.TEAM_LEAD);
const canSeeMoney = (user) => can(user, ACCESS.PAYOUT_APPROVAL);
const canSeeTime = (user) => org.seesEveryone(user);

// ---------------------------------------------------------------- a month's people

// The roles on a client's tickets, each a list of people.
const ROLES = ['smm', 'designer', 'shooter', 'editor', 'contentManager'];
const MAX_IN_ROLE = 20;

// A role's people on a month: its list, or — for a month saved before the
// lists existed — its single field.
function listOf(cm, role) {
  const list = cm?.people?.[role];
  if (list?.length) return list.map(idOf);
  return cm?.[role] ? [idOf(cm[role])] : [];
}

// The people on a month's `index`-th ticket of a type: each role's list
// shared out in turn, and a reel's videographer and editor from those under
// its own Social Media Manager in the chart when the list has any there.
function peopleFor(cm, index, chart) {
  const at = (list, n) => (list.length ? list[(n - 1) % list.length] : null);
  const smms = listOf(cm, 'smm');
  const smm = at(smms, index);
  // The how-many-th time this SMM's turn has come round.
  const turn = smms.length ? Math.ceil(index / smms.length) : index;
  const own = chart && cm.team && smm ? org.smmsOf(chart, cm.team).find((s) => idOf(s.employeeId) === smm) : null;
  const shooters = listOf(cm, 'shooter');
  const editors = listOf(cm, 'editor');
  const ownShooters = own ? shooters.filter((x) => own.videographers.map(idOf).includes(x)) : [];
  const ownEditors = own ? editors.filter((x) => own.editors.map(idOf).includes(x)) : [];
  return {
    smm,
    // Posts: the Graphic Designer; the Social Media Manager when there's none.
    designer: at(listOf(cm, 'designer'), index) || smm,
    shooter: ownShooters.length ? at(ownShooters, turn) : at(shooters, index),
    editor: ownEditors.length ? at(ownEditors, turn) : at(editors, index),
    contentManager: at(listOf(cm, 'contentManager'), index),
  };
}

// What a month needs before its tickets can be made.
function checkReady(cm, counts) {
  const anything = Object.values(counts).some((n) => n > 0);
  if (!anything) return;
  if (!cm.team || !listOf(cm, 'smm').length) throw ApiError.badRequest('Choose the team and its Social Media Manager first');
  if (!listOf(cm, 'contentManager').length) throw ApiError.badRequest('Choose the Content Manager');
  if (counts.reels > 0 && (!listOf(cm, 'shooter').length || !listOf(cm, 'editor').length)) throw ApiError.badRequest('Reels need their videographer and video editor');
}

// Each client's latest plan before a month — the one still in force when the
// month has none of its own.
async function latestPlansBefore(clientIds, key) {
  if (!clientIds.length) return [];
  const rows = await ClientMonth.aggregate([
    { $match: { client: { $in: clientIds }, month: { $lt: key } } },
    { $sort: { month: -1 } },
    { $group: { _id: '$client', doc: { $first: '$$ROOT' } } },
  ]);
  return rows.map((r) => r.doc);
}

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
// and done per type (extras included — "9 of 8"), what is carried over from
// before, and — for the CEO and admin — the time logged and the money.
async function cards(user, { month } = {}) {
  const key = checkMonth(month || cw.currentMonthKey());
  const { year, month: m } = cw.parseMonth(key);
  const range = istMonthRange(year, m);
  const time = canSeeTime(user);
  const [clients, months, tickets, carried, logged] = await Promise.all([
    TaskClient.find({ isDeleted: { $ne: true } }).select('name brandName logoUrl workPaused').sort({ name: 1 }).lean(),
    ClientMonth.find({ month: key }).lean(),
    Ticket.find({ 'deliverable.month': key }).select('client deliverable status isRejected locked').lean(),
    Ticket.find({ carriedOver: true, status: TICKET_STATUS.OPEN }).select('client deliverable').lean(),
    time
      ? WorkLog.aggregate([
          { $match: { deleted: false, superseded: { $ne: true }, client: { $ne: null }, startedAt: { $gte: range.start, $lt: range.end } } },
          { $group: { _id: '$client', minutes: { $sum: '$minutes' } } },
        ])
      : [],
  ]);
  // From this month on, a client (not paused) with no plan of its own for the
  // month goes on with its latest one.
  const goesOn = key >= cw.currentMonthKey();
  const ownOf = (c) => months.find((x) => idOf(x.client) === idOf(c._id));
  const earlier = goesOn ? await latestPlansBefore(clients.filter((c) => !c.workPaused && !ownOf(c)).map((c) => c._id), key) : [];
  const planOf = (c) => ownOf(c) || earlier.find((x) => idOf(x.client) === idOf(c._id)) || null;
  const plans = clients.map(planOf).filter(Boolean);
  const chart = plans.some((x) => x.team) ? await org.loadChart() : null;
  const people = await Employee.find({ _id: { $in: plans.flatMap((x) => listOf(x, 'smm')) } }).select('firstName lastName').lean();
  const personName = (id) => nameOf(people.find((p) => idOf(p._id) === idOf(id)));
  const money = canSeeMoney(user);
  const invoices = money ? await Invoice.find({ year, month: m }).select('client amount').lean() : [];

  return {
    month: key,
    monthLabel: cw.monthLabel(key),
    types: cw.CONTENT_TYPES,
    canPlan: canPlan(user),
    canAddClient: canAddClient(user),
    canSeeMoney: money,
    canSeeTime: time,
    cards: clients.map((c) => {
      const own = ownOf(c);
      const cm = planOf(c);
      const mine = tickets.filter((t) => idOf(t.client) === idOf(c._id) && isActive(t));
      const progress = Object.fromEntries(
        cw.CONTENT_TYPE_KEYS.map((k) => {
          const of = mine.filter((t) => t.deliverable.type === k);
          return [
            k,
            {
              committed: cm?.counts?.[k] || 0,
              made: of.length,
              extra: of.filter((t) => t.deliverable.extra).length,
              toStart: of.filter((t) => t.locked && t.status === TICKET_STATUS.OPEN).length,
              done: of.filter((t) => t.status === TICKET_STATUS.COMPLETED).length,
            },
          ];
        })
      );
      const inv = invoices.find((i) => idOf(i.client) === idOf(c._id));
      const smms = listOf(cm, 'smm').map((id) => ({ _id: id, name: personName(id) }));
      return {
        client: { _id: idOf(c._id), name: c.name, brandName: c.brandName || '', logoUrl: c.logoUrl || '', workPaused: Boolean(c.workPaused) },
        planned: Boolean(cm),
        // Going on with an earlier month's plan (this month has none of its own).
        carriedFrom: cm && !own ? cm.month : null,
        team: cm?.team ? { _id: idOf(cm.team), title: cm.teamName || chart?.byId.get(idOf(cm.team))?.title || '' } : null,
        smm: smms[0] || null,
        smms,
        generatedAt: own?.generatedAt || null,
        progress,
        carriedOver: carried.filter((t) => idOf(t.client) === idOf(c._id)).length,
        ...(time ? { hoursLogged: Math.round(((logged.find((l) => idOf(l._id) === idOf(c._id))?.minutes || 0) / 60) * 10) / 10 } : {}),
        ...(money ? { revenue: inv ? { amount: inv.amount, source: 'invoice' } : own?.fee != null ? { amount: own.fee, source: 'fee' } : null } : {}),
      };
    }),
  };
}

// ---------------------------------------------------------------- one client's month

async function detail(user, clientId, month) {
  const key = checkMonth(month);
  const client = await loadClient(clientId);
  const { year, month: m } = cw.parseMonth(key);
  const cm = await ClientMonth.findOne({ client: client._id, month: key }).lean();
  // None of its own: the latest plan before it — still in force from this
  // month on (unless the client is paused), else offered to start from.
  const earlier = cm ? null : await ClientMonth.findOne({ client: client._id, month: { $lt: key } }).sort({ month: -1 }).lean();
  const carries = Boolean(earlier) && key >= cw.currentMonthKey() && !client.workPaused;
  const tickets = cm ? await Ticket.find({ 'deliverable.clientMonth': cm._id }).sort({ 'deliverable.type': 1, 'deliverable.index': 1 }).lean() : [];
  const carried = await Ticket.find({ client: client._id, carriedOver: true, status: TICKET_STATUS.OPEN, 'deliverable.month': { $lt: key } }).sort({ dueAt: 1 }).lean();
  const all = [...tickets, ...carried];
  const time = canSeeTime(user);
  const minutes =
    time && all.length
      ? await WorkLog.aggregate([
          { $match: { deleted: false, superseded: { $ne: true }, ticket: { $in: all.map((t) => t._id) } } },
          { $group: { _id: '$ticket', minutes: { $sum: '$minutes' } } },
        ])
      : [];
  const src = cm || earlier;
  const peopleIds = src ? [...new Set(ROLES.flatMap((r) => listOf(src, r)))] : [];
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
    extra: Boolean(t.deliverable?.extra),
    locked: Boolean(t.locked),
    parkedIn: t.parkedIn || null,
    carriedOver: Boolean(t.carriedOver),
    stageLabel: pipe.stepLabel(t, t.stage),
    color: pipe.colorFor(t, now),
    ...(time ? { minutes: minutes.find((x) => idOf(x._id) === idOf(t._id))?.minutes || 0 } : {}),
  });

  return {
    client: { _id: idOf(client._id), name: client.name, workPaused: Boolean(client.workPaused) },
    month: key,
    monthLabel: cw.monthLabel(key),
    canPlan: canPlan(user),
    canSeeMoney: money,
    canSeeTime: time,
    // More tickets by hand, beyond the count: once the month has started and its plan is saved.
    canAddExtra: canPlan(user) && Boolean(cm) && key <= cw.currentMonthKey(),
    types: cw.CONTENT_TYPES,
    plan: src
      ? {
          fromMonth: src.month,
          // Going on with an earlier month's plan, unchanged.
          carried: carries,
          // An earlier month's plan, offered to start from (a past month, or a paused client).
          isSuggestion: !cm && !carries,
          counts: countsOf(src),
          team: src.team ? idOf(src.team) : null,
          teamName: src.teamName || '',
          people: Object.fromEntries(ROLES.map((r) => [r, listOf(src, r).map(person)])),
          smm: person(listOf(src, 'smm')[0]),
          designer: person(listOf(src, 'designer')[0]),
          shooter: person(listOf(src, 'shooter')[0]),
          editor: person(listOf(src, 'editor')[0]),
          contentManager: person(listOf(src, 'contentManager')[0]),
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
  // Each role's people: `people.<role>` (a list), or the older single field.
  const chosen = {};
  for (const role of ROLES) {
    const given = input.people?.[role] !== undefined ? input.people[role] : input[role];
    const list = [];
    for (const x of Array.isArray(given) ? given : given ? [given] : []) {
      const id = idOf(x);
      if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Choose people from the list');
      if (!list.includes(id)) list.push(id);
    }
    if (list.length > MAX_IN_ROLE) throw ApiError.badRequest(`At most ${MAX_IN_ROLE} people in one role`);
    // The team's Content Manager picks from the team; the Team Lead, CEO and admin from anyone.
    if (team && !picksFromAnyTeam(user) && list.some((id) => !members.includes(id))) throw ApiError.badRequest(`Choose people from ${team.title}`);
    chosen[role] = list;
  }
  // A role left empty: everyone holding it in the team.
  const heads = team ? org.teamHeads(chart, team._id) : [];
  const fill = (role, ...fromTeam) => (chosen[role].length ? chosen[role] : fromTeam.find((l) => l.length) || []);
  const people = {
    smm: fill('smm', holders(org.TEAM_ROLE.SOCIAL_MEDIA_MANAGER)),
    // None in the team: the Social Media Manager makes the posts.
    designer: fill('designer', holders(org.TEAM_ROLE.GRAPHIC_DESIGNER)),
    shooter: fill('shooter', holders(org.TEAM_ROLE.VIDEOGRAPHER)),
    editor: fill('editor', holders(org.TEAM_ROLE.EDITOR)),
    contentManager: fill('contentManager', holders(org.TEAM_ROLE.CONTENT_MANAGER), heads),
  };
  const set = {
    counts,
    team: team ? team._id : null,
    teamName: team ? team.title : '',
    people,
    // The first of each, for screens that show one.
    smm: people.smm[0] || null,
    designer: people.designer[0] || people.smm[0] || null,
    shooter: people.shooter[0] || null,
    editor: people.editor[0] || null,
    contentManager: people.contentManager[0] || null,
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

// One ticket of a month: the type's `index`-th, locked, with its people.
async function makeTicket(user, client, cm, type, index, chart, { extra = false } = {}) {
  const today = istParts(new Date());
  const { year, month } = cw.parseMonth(cm.month);
  const fromDay = today.year === year && today.month === month ? today.day : 1;
  // Its real due date is set when work is started; until then, the month's end.
  const [dueAt] = cw.spreadDueDates(cm.month, 1, { fromDay, total: 1, startIndex: 1 });
  const n = countsOf(cm)[type.key];
  const p = peopleFor(cm, index, chart);
  const input = {
    title: `${client.name} · ${type.label} ${index} · ${cw.monthLabel(cm.month)}`,
    description: extra
      ? `An extra ${type.label.toLowerCase()} for ${client.name} in ${cw.monthLabel(cm.month)}, beyond the plan's ${n}.`
      : `From ${client.name}'s plan for ${cw.monthLabel(cm.month)}: ${n} ${type.plural.toLowerCase()}.`,
    dueAt,
    clientName: client.name,
    pipeline: type.pipeline,
    team: cm.team,
    smm: p.smm,
    assignments: { smm: p.smm, contentManager: p.contentManager, designer: p.designer, shooter: p.shooter, editor: p.editor },
  };
  const ticket = await ticketService.raise(user, input, {
    system: true,
    quiet: true,
    bare: true,
    locked: true,
    chart,
    extra: { client: client._id, deliverable: { clientMonth: cm._id, month: cm.month, type: type.key, index, ...(extra ? { extra: true } : {}) } },
  });
  return { _id: idOf(ticket._id), type: type.key, raisedFor: idOf(ticket.raisedFor) };
}

// Makes the month's tickets match its counts. Extra tickets (made by hand
// beyond the count) are left alone, and taken into the count when it is raised.
async function sync(user, cm, { client: givenClient = null, chart: givenChart = null, notify = true } = {}) {
  const client = givenClient || (await loadClient(cm.client));
  const chart = givenChart || (await org.loadChart());
  const counts = countsOf(cm);
  checkReady(cm, counts);

  const existing = await Ticket.find({ 'deliverable.clientMonth': cm._id }).lean();
  const now = new Date();
  const created = [];
  const removed = [];
  const isPlanned = (t) => isActive(t) && !t.deliverable.extra;

  // Taking off first, so a lowered count fails before anything is made.
  for (const type of cw.CONTENT_TYPES) {
    const active = existing.filter((t) => t.deliverable.type === type.key && isPlanned(t));
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
    const planned = existing.filter((t) => t.deliverable.type === type.key && isPlanned(t));
    if (planned.length >= n) continue;
    // A raised count takes in the extras already made, before making more.
    const extras = existing.filter((t) => t.deliverable.type === type.key && isActive(t) && t.deliverable.extra).sort((a, b) => a.deliverable.index - b.deliverable.index);
    const takenIn = extras.slice(0, n - planned.length);
    if (takenIn.length) {
      // eslint-disable-next-line no-await-in-loop
      await Ticket.updateMany({ _id: { $in: takenIn.map((t) => t._id) } }, { $set: { 'deliverable.extra': false } });
    }
    const used = new Set(existing.filter((t) => t.deliverable.type === type.key && isActive(t)).map((t) => t.deliverable.index));
    const missing = [];
    for (let i = 1; missing.length < n - planned.length - takenIn.length; i += 1) if (!used.has(i)) missing.push(i);
    for (const index of missing) {
      // eslint-disable-next-line no-await-in-loop
      created.push(await makeTicket(user, client, cm, type, index, chart));
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

// One more ticket of a type, by hand, beyond the month's count — "9 of 8
// reels". The plan's count stays as it is.
async function addExtra(user, clientId, month, type) {
  if (!canPlan(user)) throw ApiError.forbidden('Only HR, the CEO and admin make a client’s tickets');
  const key = checkMonth(month);
  if (key > cw.currentMonthKey()) throw ApiError.badRequest('Extra tickets are made once the month has started');
  const kind = cw.typeOf(type);
  if (!kind) throw ApiError.badRequest('Choose a reel, post, story or festive story');
  const client = await loadClient(clientId);
  const cm = await ClientMonth.findOne({ client: client._id, month: key });
  if (!cm) throw ApiError.badRequest('Save this month’s plan first');
  checkReady(cm, { ...countsOf(cm), [kind.key]: Math.max(1, countsOf(cm)[kind.key]) });
  const same = await Ticket.find({ 'deliverable.clientMonth': cm._id, 'deliverable.type': kind.key }).select('deliverable').lean();
  if (same.filter(isActive).length >= COUNT_MAX) throw ApiError.badRequest(`${kind.plural}: at most ${COUNT_MAX} in a month`);
  // The next number after every one made, so no two share a title.
  const index = Math.max(0, ...same.map((t) => t.deliverable.index || 0)) + 1;
  const chart = await org.loadChart();
  const made = await makeTicket(user, client, cm, kind, index, chart, { extra: true });
  await notifyMade(client, cm, [made]).catch((err) => logger.error({ err }, 'Client work notification failed'));
  return { ...(await detail(user, client._id, key)), result: { created: 1, removed: 0 } };
}

// ---------------------------------------------------------------- adding a client

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A new client, by name (and brand). One removed before under the same name
// comes back, with its months and tickets, rather than clashing with it —
// names are unique even among removed clients.
async function addClient(user, { name, brandName } = {}) {
  if (!canAddClient(user)) throw ApiError.forbidden('Only the CEO and admin add a client');
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (!clean) throw ApiError.badRequest('Write the client’s name');
  if (clean.length > 120) throw ApiError.badRequest('That name is too long');
  const brand = String(brandName || '').trim().replace(/\s+/g, ' ').slice(0, 120) || undefined;

  const same = await TaskClient.find({ name: new RegExp(`^${escapeRe(clean)}$`, 'i') });
  const live = same.find((c) => !c.isDeleted);
  if (live) throw ApiError.conflict(`${live.name} is already a client`);
  const removed = same.find((c) => c.name === clean) || same[0];
  if (removed) {
    removed.isDeleted = false;
    if (brand) removed.brandName = brand;
    await removed.save();
    return { client: { _id: idOf(removed._id), name: removed.name }, restored: true };
  }
  try {
    const client = await TaskClient.create({ name: clean, brandName: brand });
    return { client: { _id: idOf(client._id), name: client.name }, restored: false };
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict(`${clean} is already a client`);
    throw err;
  }
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

// Each client's new month as a copy of its latest plan (unless paused) — a
// plan carries on until it is changed — then the tickets for every month
// that has started and hasn't had them made.
async function rollMonth(now = new Date()) {
  const key = cw.currentMonthKey(now);
  const user = await systemUser();
  if (!user) return { started: 0, generated: 0 };
  const clients = await TaskClient.find({ isDeleted: { $ne: true }, workPaused: { $ne: true } }).select('_id').lean();
  let started = 0;
  for (const c of clients) {
    // eslint-disable-next-line no-await-in-loop
    const [have, last] = await Promise.all([ClientMonth.exists({ client: c._id, month: key }), ClientMonth.findOne({ client: c._id, month: { $lt: key } }).sort({ month: -1 }).lean()]);
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
      people: Object.fromEntries(ROLES.map((r) => [r, listOf(last, r)])),
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

module.exports = { cards, detail, saveMonth, sync, generate, addExtra, addClient, setPaused, rollMonth, carryOver, canPlan, canSeeMoney, canSeeTime };
