const ApiError = require('../utils/ApiError');
const Employee = require('../models/Employee');
const WorkLog = require('../models/WorkLog');
const Ticket = require('../models/Ticket');
const TaskClient = require('../models/TaskClient');
const ClientMonth = require('../models/ClientMonth');
const Invoice = require('../models/Invoice');
const Holiday = require('../models/Holiday');
const ClientValueReport = require('../models/ClientValueReport');
const { salaryForPeriod } = require('./salaryCalculation.service');
const holding = require('./holding.service');
const org = require('./orgHierarchy.service');
const { can } = require('../utils/roles');
const { ACCESS } = require('../config/access');
const { istMonthRange, istDaysInMonth, istDateKey } = require('../utils/istDate');
const cw = require('../utils/clientWork');

// Was each client worth the team's time? For a month: every minute logged
// on a client's tickets, priced at the person's hourly cost — that month's
// salary ÷ (the month's working days × 8 hours) — set against what the
// client pays (its invoice for the month, else the fee typed on its month).
// Time on other work, on tickets for no client, and paid time nobody logged
// is overhead, shown on its own line. Beside the logged time, an automatic
// estimate shares each person's working day across the tickets that were
// waiting on them, so a gap between the two stands out. CEO/admin only; a
// closed month is frozen.

const idOf = org.idOf;
const nameOf = (e) => (e ? `${e.firstName} ${e.lastName || ''}`.trim() : null);
const MIN = 60000;
const r2 = (n) => Math.round(n * 100) / 100;
const hours = (minutes) => Math.round((minutes / 60) * 10) / 10;

function needMoney(user) {
  if (!can(user, ACCESS.PAYOUT_APPROVAL)) throw ApiError.forbidden('Only the CEO and admin see the client value report — it uses salaries');
}

// The month's working days (no Sundays, no company holidays), as day numbers.
async function workingDays(year, month) {
  const holidays = await Holiday.find({ date: { $gte: new Date(Date.UTC(year, month - 1, 1)), $lt: new Date(Date.UTC(year, month, 1)) }, type: 'holiday' })
    .select('date')
    .lean();
  const off = new Set(holidays.map((h) => new Date(h.date).toISOString().slice(0, 10)));
  const out = [];
  for (let d = 1; d <= istDaysInMonth(year, month); d += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() !== 0 && !off.has(key)) out.push(d);
  }
  return out;
}

// The automatic estimate — the same held-time calculation people confirm
// their hours against (holding.service.js), for everyone, by ticket.
async function heldSplit(range) {
  const { minutes, tickets } = await holding.holdingFor({ from: range.start, to: new Date(Math.min(Date.now(), range.end.getTime())) });
  const out = new Map(); // ticketId → { ticket, people: Map(employee → minutes) }
  for (const [emp, perTicket] of minutes) {
    for (const [tk, m] of perTicket) {
      if (!out.has(tk)) out.set(tk, { ticket: tickets.get(tk), people: new Map() });
      out.get(tk).people.set(emp, m);
    }
  }
  return out;
}

async function compute(key) {
  const parsed = cw.parseMonth(key);
  if (!parsed) throw ApiError.badRequest('Choose a month');
  const { year, month } = parsed;
  const range = istMonthRange(year, month);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const days = await workingDays(year, month);
  const fullHours = days.length * cw.HOURS_PER_DAY;
  const now = Date.now();

  const logs = await WorkLog.find({ deleted: false, superseded: { $ne: true }, startedAt: { $gte: range.start, $lt: range.end } }).lean();
  const logEmployeeIds = [...new Set(logs.map((l) => idOf(l.employee)))];
  const people = await Employee.find({
    isDeleted: { $ne: true },
    $or: [{ status: 'active', excludeFromPayroll: { $ne: true } }, { _id: { $in: logEmployeeIds } }],
  })
    .select('firstName lastName designation monthlyPay ctcAnnual salaryHistory dateOfJoining endDate status workingHoursStart workingHoursEnd')
    .lean();
  const employees = new Map(people.map((e) => [idOf(e._id), e]));
  const rate = new Map(
    people.map((e) => {
      const pay = Number(salaryForPeriod(e, monthStart)?.monthlyPay) || 0;
      return [idOf(e._id), fullHours ? pay / fullHours : 0];
    })
  );
  // Paid hours: the working days they were employed for — in a month still
  // going, only the days already over (today counts once it has ended).
  const today = istDateKey(new Date(now));
  const dayKey = (d) => `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const daysSoFar = days.filter((d) => dayKey(d) < today);
  const paidHours = (e) => {
    const joined = e.dateOfJoining ? istDateKey(e.dateOfJoining) : null;
    const left = e.endDate ? istDateKey(e.endDate) : null;
    const n = daysSoFar.filter((d) => {
      const k = dayKey(d);
      return (!joined || k >= joined) && (!left || k <= left);
    }).length;
    return n * cw.HOURS_PER_DAY;
  };

  const ticketIds = [...new Set(logs.map((l) => l.ticket).filter(Boolean).map(idOf))];
  const tickets = new Map((await Ticket.find({ _id: { $in: ticketIds } }).select('client deliverable pipeline').lean()).map((t) => [idOf(t._id), t]));

  const clients = new Map(); // clientId → bucket
  const bucket = (id) => {
    if (!clients.has(id)) clients.set(id, { minutes: 0, cost: 0, byType: {}, byPerson: new Map(), estMinutes: 0, estCost: 0 });
    return clients.get(id);
  };
  const overhead = { other: {}, nonClient: { minutes: 0, cost: 0 }, unlogged: { minutes: 0, cost: 0 } };
  const personStats = new Map();
  const stat = (id) => {
    if (!personStats.has(id)) personStats.set(id, { client: 0, other: 0, nonClient: 0, overtime: 0, cost: 0 });
    return personStats.get(id);
  };

  for (const l of logs) {
    const emp = idOf(l.employee);
    const minutes = l.endedAt ? l.minutes : Math.max(0, Math.round((now - new Date(l.startedAt).getTime()) / MIN));
    const cost = (minutes / 60) * (rate.get(emp) || 0);
    const s = stat(emp);
    s.overtime += l.overtimeMinutes || 0;
    s.cost += cost;
    const t = l.ticket ? tickets.get(idOf(l.ticket)) : null;
    const clientId = idOf(l.client || t?.client);
    // A meeting tagged with a client is that client's time.
    if (l.kind === 'other' && !clientId) {
      const o = (overhead.other[l.otherKind] ||= { kind: l.otherKind, label: cw.OTHER_WORK[l.otherKind], minutes: 0, cost: 0 });
      o.minutes += minutes;
      o.cost += cost;
      s.other += minutes;
    } else if (!clientId) {
      overhead.nonClient.minutes += minutes;
      overhead.nonClient.cost += cost;
      s.nonClient += minutes;
    } else {
      const b = bucket(clientId);
      b.minutes += minutes;
      b.cost += cost;
      const type = t?.deliverable?.type || (l.kind === 'other' ? 'meetings' : 'other');
      const bt = (b.byType[type] ||= { minutes: 0, cost: 0 });
      bt.minutes += minutes;
      bt.cost += cost;
      const bp = b.byPerson.get(emp) || { minutes: 0, cost: 0 };
      bp.minutes += minutes;
      bp.cost += cost;
      b.byPerson.set(emp, bp);
      s.client += minutes;
    }
  }

  // The estimate, by client.
  const held = await heldSplit(range);
  for (const { ticket, people: ppl } of held.values()) {
    if (!ticket?.client) continue;
    const b = bucket(idOf(ticket.client));
    for (const [emp, m] of ppl) {
      b.estMinutes += m;
      b.estCost += (m / 60) * (rate.get(emp) || 0);
    }
  }

  // Committed and done, revenue.
  const months = await ClientMonth.find({ month: key }).lean();
  for (const cm of months) bucket(idOf(cm.client));
  const plannedTickets = await Ticket.find({ 'deliverable.month': key, 'deliverable.removed': { $ne: true } }).select('client deliverable status').lean();
  const invoices = await Invoice.find({ year, month }).select('client amount status').lean();
  const names = new Map((await TaskClient.find({ _id: { $in: [...clients.keys()] } }).select('name').lean()).map((c) => [idOf(c._id), c.name]));
  const settings = await getSettings();

  const clientRows = [...clients.entries()].map(([id, b]) => {
    const cm = months.find((x) => idOf(x.client) === id);
    const inv = invoices.find((i) => idOf(i.client) === id);
    const revenue = inv ? inv.amount : cm?.fee ?? null;
    const mine = plannedTickets.filter((t) => idOf(t.client) === id);
    const deliverables = Object.fromEntries(
      cw.CONTENT_TYPE_KEYS.map((k) => {
        const of = mine.filter((t) => t.deliverable.type === k);
        const typeCost = b.byType[k]?.cost || 0;
        const done = of.filter((t) => t.status === 'completed').length;
        return [k, { committed: cm?.counts?.[k] || 0, done, minutes: Math.round(b.byType[k]?.minutes || 0), cost: r2(typeCost), costPerDone: done ? r2(typeCost / done) : null }];
      })
    );
    const margin = revenue != null ? r2(revenue - b.cost) : null;
    const marginPct = revenue ? Math.round(((revenue - b.cost) / revenue) * 1000) / 10 : null;
    return {
      client: { _id: id, name: names.get(id) || 'Client' },
      revenue,
      revenueSource: inv ? 'invoice' : cm?.fee != null ? 'fee' : null,
      hours: hours(b.minutes),
      cost: r2(b.cost),
      estimatedHours: hours(b.estMinutes),
      estimatedCost: r2(b.estCost),
      margin,
      marginPct,
      worthIt: marginPct == null ? null : marginPct >= settings.targetMarginPct,
      unconfirmedHours: hours(logs.filter((l) => idOf(l.client) === id && (l.pending || l.autoConfirmed)).reduce((tt, l) => tt + l.minutes, 0)),
      changedHours: logs.filter((l) => idOf(l.client) === id && l.changed).length,
      deliverables,
      people: [...b.byPerson.entries()]
        .map(([emp, v]) => ({ _id: emp, name: nameOf(employees.get(emp)), hours: hours(v.minutes), cost: r2(v.cost) }))
        .sort((a, c) => c.cost - a.cost),
    };
  });
  clientRows.sort((a, c) => (c.revenue ?? -1) - (a.revenue ?? -1) || c.cost - a.cost);

  // People: their paid hours, what they logged, and what was left unlogged.
  const peopleRows = people
    .map((e) => {
      const id = idOf(e._id);
      const s = personStats.get(id) || { client: 0, other: 0, nonClient: 0, overtime: 0, cost: 0 };
      const paid = paidHours(e);
      const logged = s.client + s.other + s.nonClient;
      const unloggedMinutes = Math.max(0, paid * 60 - logged);
      const unloggedCost = (unloggedMinutes / 60) * (rate.get(id) || 0);
      overhead.unlogged.minutes += unloggedMinutes;
      overhead.unlogged.cost += unloggedCost;
      return {
        _id: id,
        name: nameOf(e),
        designation: e.designation || '',
        hourlyCost: r2(rate.get(id) || 0),
        noSalary: !(rate.get(id) > 0),
        paidHours: paid,
        loggedHours: hours(logged),
        clientHours: hours(s.client),
        otherHours: hours(s.other + s.nonClient),
        overtimeHours: hours(s.overtime),
        utilizationPct: paid ? Math.round((logged / (paid * 60)) * 1000) / 10 : null,
      };
    })
    .filter((p) => p.paidHours > 0 || p.loggedHours > 0)
    .sort((a, b) => (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0));

  const otherRows = Object.values(overhead.other).map((o) => ({ ...o, hours: hours(o.minutes), cost: r2(o.cost) }));
  const overheadCost = otherRows.reduce((t, o) => t + o.cost, 0) + overhead.nonClient.cost + overhead.unlogged.cost;
  const known = clientRows.filter((c) => c.revenue != null);
  const byType = Object.fromEntries(
    cw.CONTENT_TYPE_KEYS.map((k) => {
      const cost = clientRows.reduce((t, c) => t + c.deliverables[k].cost, 0);
      const done = clientRows.reduce((t, c) => t + c.deliverables[k].done, 0);
      return [k, { label: cw.typeOf(k).plural, cost: r2(cost), done, hours: hours(clientRows.reduce((t, c) => t + c.deliverables[k].minutes, 0)), costPerDone: done ? r2(cost / done) : null }];
    })
  );

  return {
    month: key,
    monthLabel: cw.monthLabel(key),
    workingDays: days.length,
    // Working days already over — paid and unlogged hours count only these.
    workingDaysSoFar: daysSoFar.length,
    hoursPerDay: cw.HOURS_PER_DAY,
    targetMarginPct: settings.targetMarginPct,
    clients: clientRows,
    byType,
    people: peopleRows,
    overhead: {
      other: otherRows,
      nonClientTickets: { hours: hours(overhead.nonClient.minutes), cost: r2(overhead.nonClient.cost) },
      unlogged: { hours: hours(overhead.unlogged.minutes), cost: r2(overhead.unlogged.cost) },
      cost: r2(overheadCost),
    },
    totals: {
      revenue: r2(known.reduce((t, c) => t + c.revenue, 0)),
      clientCost: r2(clientRows.reduce((t, c) => t + c.cost, 0)),
      costOfClientsWithRevenue: r2(known.reduce((t, c) => t + c.cost, 0)),
      overheadCost: r2(overheadCost),
      salaryCost: r2(peopleRows.reduce((t, p) => t + p.hourlyCost * p.paidHours, 0)),
      loggedHours: hours(logs.reduce((t, l) => t + (l.endedAt ? l.minutes : 0), 0)),
    },
    generatedAt: new Date(),
  };
}

// ---------------------------------------------------------------- settings, closing

async function getSettings() {
  const s = await ClientValueReport.findOne({ key: 'settings' }).lean();
  return { targetMarginPct: s?.targetMarginPct ?? 30 };
}

async function setTarget(user, pct) {
  needMoney(user);
  const n = Number(pct);
  if (!Number.isFinite(n) || n < 0 || n > 95) throw ApiError.badRequest('The target margin is a percentage from 0 to 95');
  await ClientValueReport.updateOne({ key: 'settings' }, { $set: { targetMarginPct: n } }, { upsert: true });
  return getSettings();
}

async function report(user, { month } = {}) {
  needMoney(user);
  const key = month || cw.currentMonthKey();
  const closed = await ClientValueReport.findOne({ key }).populate('closedBy', 'username').lean();
  if (closed?.closedAt) return { ...closed.data, closed: { at: closed.closedAt, by: closed.closedBy?.username || null } };
  return { ...(await compute(key)), closed: null };
}

async function close(user, month) {
  needMoney(user);
  if (!cw.parseMonth(month)) throw ApiError.badRequest('Choose a month');
  if (month >= cw.currentMonthKey()) throw ApiError.conflict('A month can only be closed once it is over');
  const data = await compute(month);
  await ClientValueReport.updateOne({ key: month }, { $set: { data, closedAt: new Date(), closedBy: user.id, targetMarginPct: data.targetMarginPct } }, { upsert: true });
  return report(user, { month });
}

async function reopen(user, month) {
  needMoney(user);
  await ClientValueReport.deleteOne({ key: month, closedAt: { $ne: null } });
  return report(user, { month });
}

module.exports = { report, close, reopen, setTarget, getSettings, compute, workingDays };
