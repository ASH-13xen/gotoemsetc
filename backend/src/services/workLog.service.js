const ApiError = require('../utils/ApiError');
const WorkLog = require('../models/WorkLog');
const Ticket = require('../models/Ticket');
const Employee = require('../models/Employee');
const DevicePunch = require('../models/DevicePunch');
const ticketService = require('./ticket.service');
const org = require('./orgHierarchy.service');
const { istInstant, istParts, istDateKey } = require('../utils/istDate');
const { TICKET_STATUS } = require('../config/constants');
const cw = require('../utils/clientWork');

// The work timer. "Start working" on a ticket (or on other work — a meeting,
// internal work, training) starts a stretch of time; starting something else
// ends it; "Pause" ends it. It stops itself at lunch (13:30), at the end of
// the person's shift and at the end of the day; overnight, a stretch the
// timer stopped is cut back to the person's last scan if they left earlier.
// Starting again after the shift is overtime, and counts. Everyone sees their
// own time; only the CEO and admin see anyone else's, and add, correct and
// remove stretches — every change is kept on the stretch.

const idOf = org.idOf;
const nameOf = (e) => (e ? `${e.firstName} ${e.lastName || ''}`.trim() : null);
const MIN = 60000;

// A day's boundaries for a person, in IST: shift start/end, lunch, day end.
function dayBounds(employee, at) {
  const { year, month, day } = istParts(at);
  const s = cw.hm(employee?.workingHoursStart, cw.DEFAULT_SHIFT.start);
  const e = cw.hm(employee?.workingHoursEnd, cw.DEFAULT_SHIFT.end);
  return {
    shiftStart: istInstant(year, month, day, s.hour, s.minute),
    shiftEnd: istInstant(year, month, day, e.hour, e.minute),
    lunchStart: istInstant(year, month, day, cw.LUNCH.start.hour, cw.LUNCH.start.minute),
    lunchEnd: istInstant(year, month, day, cw.LUNCH.end.hour, cw.LUNCH.end.minute),
    dayEnd: new Date(istInstant(year, month, day, 23, 59).getTime() + 59000),
  };
}

const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

// Minutes, and how many of them fell outside the shift.
function measure(employee, startedAt, endedAt) {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const minutes = Math.max(0, Math.round((end - start) / MIN));
  const b = dayBounds(employee, startedAt);
  const inShift = Math.round(overlap(start, end, b.shiftStart.getTime(), b.shiftEnd.getTime()) / MIN);
  return { minutes, overtimeMinutes: Math.max(0, minutes - inShift) };
}

async function close(log, endedAt, reason, employee) {
  const emp = employee || (await Employee.findById(log.employee).select('workingHoursStart workingHoursEnd').lean());
  const end = new Date(Math.max(new Date(log.startedAt).getTime(), new Date(endedAt).getTime()));
  const { minutes, overtimeMinutes } = measure(emp, log.startedAt, end);
  log.endedAt = end;
  log.minutes = minutes;
  log.overtimeMinutes = overtimeMinutes;
  log.stopReason = reason;
  await log.save();
  return log;
}

function needEmployee(user) {
  if (!user.employeeLink) throw ApiError.badRequest("This login isn't linked to an employee, so it has no work timer");
  return user.employeeLink;
}

// ---------------------------------------------------------------- the timer

async function shape(log) {
  if (!log) return null;
  const ticket = log.ticket ? await Ticket.findById(log.ticket).select('number title clientName').lean() : null;
  return {
    _id: idOf(log._id),
    kind: log.kind,
    ticket: ticket ? { _id: idOf(ticket._id), code: ticketService.codeOf(ticket.number), title: ticket.title, clientName: ticket.clientName || '' } : null,
    otherKind: log.otherKind || null,
    otherLabel: log.otherKind ? cw.OTHER_WORK[log.otherKind] : null,
    note: log.note || '',
    startedAt: log.startedAt,
    endedAt: log.endedAt,
    minutes: log.endedAt ? log.minutes : Math.max(0, Math.round((Date.now() - new Date(log.startedAt).getTime()) / MIN)),
    overtimeMinutes: log.overtimeMinutes || 0,
    stopReason: log.stopReason || null,
    source: log.source,
    edited: (log.edits || []).length > 0,
  };
}

async function todayMinutes(employeeId) {
  const { year, month, day } = istParts(new Date());
  const start = istInstant(year, month, day);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  const logs = await WorkLog.find({ employee: employeeId, deleted: false, superseded: { $ne: true }, startedAt: { $gte: start, $lt: end } }).lean();
  return logs.reduce((t, l) => t + (l.endedAt ? l.minutes : Math.round((Date.now() - new Date(l.startedAt).getTime()) / MIN)), 0);
}

async function current(user) {
  if (!user.employeeLink) return { running: null, todayMinutes: 0 };
  const running = await WorkLog.findOne({ employee: user.employeeLink, endedAt: null, deleted: false });
  return { running: await shape(running), todayMinutes: await todayMinutes(user.employeeLink) };
}

async function start(user, { ticketId, otherKind, note } = {}) {
  const employeeId = needEmployee(user);
  let ticket = null;
  if (ticketId) {
    ticket = await Ticket.findById(ticketId);
    if (!ticket) throw ApiError.notFound('Ticket not found');
    if (ticket.status !== TICKET_STATUS.OPEN) throw ApiError.conflict('This ticket is closed — time can only go on an open ticket');
    if (!(await ticketService.canView(user, ticket, await org.loadChart()))) throw ApiError.forbidden("You don't have access to this ticket");
  } else if (!cw.OTHER_WORK[otherKind]) {
    throw ApiError.badRequest('Choose a ticket, or what other work it is');
  }
  const employee = await Employee.findById(employeeId).select('workingHoursStart workingHoursEnd').lean();
  const now = new Date();
  const running = await WorkLog.findOne({ employee: employeeId, endedAt: null, deleted: false });
  if (running) {
    if (ticket && idOf(running.ticket) === idOf(ticket._id)) return current(user);
    await close(running, now, 'switched', employee);
  }
  try {
    await WorkLog.create({
      employee: employeeId,
      user: user.id,
      kind: ticket ? 'ticket' : 'other',
      ticket: ticket ? ticket._id : null,
      client: ticket?.client || null,
      otherKind: ticket ? null : otherKind,
      note: note ? String(note).slice(0, 300) : undefined,
      startedAt: now,
      source: 'timer',
    });
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('Your timer was just started elsewhere — refresh');
    throw err;
  }
  return current(user);
}

async function stop(user) {
  const employeeId = needEmployee(user);
  const running = await WorkLog.findOne({ employee: employeeId, endedAt: null, deleted: false });
  if (running) await close(running, new Date(), 'paused');
  return current(user);
}

// ---------------------------------------------------------------- who sees and corrects whose time

// Whose time someone sees and corrects besides their own: the CEO and admin
// everyone's (null), nobody else anyone's.
async function managedIds(user) {
  if (org.seesEveryone(user)) return null; // everyone
  return new Set();
}

async function mayManage(user, employeeId) {
  const ids = await managedIds(user);
  return ids === null || ids.has(idOf(employeeId));
}

// ---------------------------------------------------------------- reading

function dayRange(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  if (!m) throw ApiError.badRequest('Choose a day');
  const start = istInstant(Number(m[1]), Number(m[2]), Number(m[3]));
  return { start, end: new Date(start.getTime() + 24 * 3600 * 1000) };
}

async function entries(filter) {
  const logs = await WorkLog.find(filter).sort({ startedAt: 1 }).lean();
  const ticketIds = [...new Set(logs.map((l) => l.ticket).filter(Boolean).map(idOf))];
  const tickets = await Ticket.find({ _id: { $in: ticketIds } }).select('number title clientName').lean();
  const tmap = new Map(tickets.map((t) => [idOf(t._id), t]));
  return logs.map((l) => {
    const t = l.ticket ? tmap.get(idOf(l.ticket)) : null;
    return {
      _id: idOf(l._id),
      employee: idOf(l.employee),
      kind: l.kind,
      ticket: t ? { _id: idOf(t._id), code: ticketService.codeOf(t.number), title: t.title, clientName: t.clientName || '' } : null,
      otherKind: l.otherKind || null,
      otherLabel: l.otherKind ? cw.OTHER_WORK[l.otherKind] : null,
      note: l.note || '',
      startedAt: l.startedAt,
      endedAt: l.endedAt,
      minutes: l.endedAt ? l.minutes : Math.max(0, Math.round((Date.now() - new Date(l.startedAt).getTime()) / MIN)),
      overtimeMinutes: l.overtimeMinutes || 0,
      stopReason: l.stopReason || null,
      source: l.source,
      step: l.step || null,
      estimateMinutes: l.estimateMinutes ?? null,
      changed: Boolean(l.changed),
      reason: l.reason || '',
      pending: Boolean(l.pending),
      autoConfirmed: Boolean(l.autoConfirmed),
      edits: (l.edits || []).map((e) => ({ byName: e.byName, at: e.at, note: e.note || '' })),
    };
  });
}

// One person's day — their own, or someone they manage.
async function day(user, { date, employee } = {}) {
  const target = employee || needEmployee(user);
  if (idOf(target) !== idOf(user.employeeLink) && !(await mayManage(user, target))) throw ApiError.forbidden("You can only see your own time — the CEO and admin see everyone's");
  const { start, end } = dayRange(date || istDateKey(new Date()));
  const list = await entries({ employee: target, deleted: false, superseded: { $ne: true }, startedAt: { $gte: start, $lt: end } });
  const person = await Employee.findById(target).select('firstName lastName designation').lean();
  return {
    employee: { _id: idOf(target), name: nameOf(person), designation: person?.designation || '' },
    date: istDateKey(start),
    entries: list,
    totalMinutes: list.reduce((t, e) => t + e.minutes, 0),
    canEdit: await mayManage(user, target),
  };
}

// The people someone manages, with their totals for a day.
async function team(user, { date } = {}) {
  const ids = await managedIds(user);
  const { start, end } = dayRange(date || istDateKey(new Date()));
  const filter = { status: 'active', isDeleted: { $ne: true } };
  if (ids !== null) filter._id = { $in: [...ids] };
  const people = await Employee.find(filter).select('firstName lastName designation').sort({ firstName: 1 }).lean();
  const totals = await WorkLog.aggregate([
    { $match: { deleted: false, superseded: { $ne: true }, employee: { $in: people.map((p) => p._id) }, startedAt: { $gte: start, $lt: end } } },
    { $group: { _id: '$employee', minutes: { $sum: '$minutes' }, running: { $max: { $cond: [{ $eq: ['$endedAt', null] }, 1, 0] } } } },
  ]);
  return {
    date: istDateKey(start),
    people: people.map((p) => {
      const t = totals.find((x) => idOf(x._id) === idOf(p._id));
      return { _id: idOf(p._id), name: nameOf(p), designation: p.designation || '', minutes: t?.minutes || 0, running: Boolean(t?.running) };
    }),
  };
}

// Time on one ticket, by person — for the CEO and admin.
async function forTicket(user, ticketId) {
  if (!org.seesEveryone(user)) throw ApiError.forbidden('Only the CEO and admin see the time spent on a ticket');
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  const logs = await WorkLog.find({ ticket: ticket._id, deleted: false, superseded: { $ne: true } }).lean();
  const people = await Employee.find({ _id: { $in: [...new Set(logs.map((l) => idOf(l.employee)))] } }).select('firstName lastName').lean();
  const by = new Map();
  for (const l of logs) {
    const k = idOf(l.employee);
    const m = l.endedAt ? l.minutes : Math.max(0, Math.round((Date.now() - new Date(l.startedAt).getTime()) / MIN));
    by.set(k, (by.get(k) || 0) + m);
  }
  return {
    totalMinutes: [...by.values()].reduce((a, b) => a + b, 0),
    people: [...by.entries()].map(([k, minutes]) => ({ _id: k, name: nameOf(people.find((p) => idOf(p._id) === k)), minutes })).sort((a, b) => b.minutes - a.minutes),
  };
}

// ---------------------------------------------------------------- corrections

async function resolveTarget(input) {
  if (input.ticketId) {
    const ticket = await Ticket.findById(input.ticketId).select('client').lean();
    if (!ticket) throw ApiError.badRequest('That ticket was not found');
    return { kind: 'ticket', ticket: ticket._id, client: ticket.client || null, otherKind: null };
  }
  if (!cw.OTHER_WORK[input.otherKind]) throw ApiError.badRequest('Choose a ticket, or what other work it is');
  return { kind: 'other', ticket: null, client: null, otherKind: input.otherKind };
}

function checkTimes(startedAt, endedAt) {
  const s = new Date(startedAt);
  const e = new Date(endedAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) throw ApiError.badRequest('Give the start and end times');
  if (e <= s) throw ApiError.badRequest('The end has to be after the start');
  if (e - s > 16 * 3600 * 1000) throw ApiError.badRequest('One stretch can be at most 16 hours');
  if (istDateKey(s) !== istDateKey(new Date(e.getTime() - 1))) throw ApiError.badRequest('A stretch has to start and end on the same day');
  if (e > new Date(Date.now() + 5 * MIN)) throw ApiError.badRequest("Time can't be added in the future");
  return { s, e };
}

const editorName = (user) => user.displayName || user.username;

async function add(user, input = {}) {
  if (!input.employee || !(await mayManage(user, input.employee))) throw ApiError.forbidden("Only the CEO and admin add time for someone else");
  if (!input.note?.trim()) throw ApiError.badRequest('Say why it is being added');
  const { s, e } = checkTimes(input.startedAt, input.endedAt);
  const target = await resolveTarget(input);
  const employee = await Employee.findById(input.employee).select('workingHoursStart workingHoursEnd').lean();
  if (!employee) throw ApiError.notFound('Employee not found');
  const { minutes, overtimeMinutes } = measure(employee, s, e);
  const log = await WorkLog.create({
    employee: input.employee,
    ...target,
    note: input.note.trim().slice(0, 300),
    startedAt: s,
    endedAt: e,
    minutes,
    overtimeMinutes,
    stopReason: 'manager',
    source: 'manual',
    edits: [{ by: user.id, byName: editorName(user), note: `Added: ${input.note.trim()}`, to: { startedAt: s, endedAt: e, ...target } }],
  });
  return (await entries({ _id: log._id }))[0];
}

async function edit(user, id, input = {}) {
  const log = await WorkLog.findOne({ _id: id, deleted: false });
  if (!log) throw ApiError.notFound('Entry not found');
  if (!(await mayManage(user, log.employee))) throw ApiError.forbidden("Only the CEO and admin correct someone else's time");
  if (!input.reason?.trim()) throw ApiError.badRequest('Say why it is being changed');
  if (!log.endedAt) throw ApiError.conflict('This timer is still running — it can be changed once it stops');
  const from = { startedAt: log.startedAt, endedAt: log.endedAt, kind: log.kind, ticket: log.ticket, otherKind: log.otherKind };
  const { s, e } = checkTimes(input.startedAt ?? log.startedAt, input.endedAt ?? log.endedAt);
  const target = input.ticketId || input.otherKind ? await resolveTarget(input) : { kind: log.kind, ticket: log.ticket, client: log.client, otherKind: log.otherKind };
  const employee = await Employee.findById(log.employee).select('workingHoursStart workingHoursEnd').lean();
  const { minutes, overtimeMinutes } = measure(employee, s, e);
  Object.assign(log, target, { startedAt: s, endedAt: e, minutes, overtimeMinutes });
  log.edits.push({ by: user.id, byName: editorName(user), note: input.reason.trim(), from, to: { startedAt: s, endedAt: e, ...target } });
  await log.save();
  return (await entries({ _id: log._id }))[0];
}

async function remove(user, id, { reason } = {}) {
  const log = await WorkLog.findOne({ _id: id, deleted: false });
  if (!log) throw ApiError.notFound('Entry not found');
  if (!(await mayManage(user, log.employee))) throw ApiError.forbidden("Only the CEO and admin remove someone else's time");
  if (!reason?.trim()) throw ApiError.badRequest('Say why it is being removed');
  if (!log.endedAt) await close(log, new Date(), 'manager');
  log.deleted = true;
  log.edits.push({ by: user.id, byName: editorName(user), note: `Removed: ${reason.trim()}` });
  await log.save();
  return { removed: true };
}

// ---------------------------------------------------------------- stopping by itself

// Every few minutes: a running timer passing lunch, the end of the shift or
// the end of the day stops at that moment (not when the job runs).
async function autoStop(now = new Date()) {
  const running = await WorkLog.find({ endedAt: null, deleted: false });
  let stopped = 0;
  for (const log of running) {
    // eslint-disable-next-line no-await-in-loop
    const employee = await Employee.findById(log.employee).select('workingHoursStart workingHoursEnd').lean();
    const b = dayBounds(employee, log.startedAt);
    const start = new Date(log.startedAt).getTime();
    const candidates = [
      [b.lunchStart, 'lunch'],
      [b.shiftEnd, 'shift_end'],
      [b.dayEnd, 'day_end'],
    ].filter(([t]) => t.getTime() > start && t.getTime() <= now.getTime());
    if (!candidates.length) continue;
    candidates.sort((a, c) => a[0] - c[0]);
    // eslint-disable-next-line no-await-in-loop
    await close(log, candidates[0][0], candidates[0][1], employee);
    stopped += 1;
  }
  return stopped;
}

// Overnight: a stretch the timer stopped by itself after the person's last
// scan of the day (they had left) ends at that scan instead. Needs at least
// two scans that day, the last one after noon — one scan is just the arrival.
async function trimToScans(dateKey) {
  const { start, end } = dayRange(dateKey);
  const logs = await WorkLog.find({ deleted: false, startedAt: { $gte: start, $lt: end }, stopReason: { $in: ['shift_end', 'day_end', 'lunch'] } });
  let trimmed = 0;
  const lastScan = new Map();
  for (const log of logs) {
    const k = idOf(log.employee);
    if (!lastScan.has(k)) {
      // eslint-disable-next-line no-await-in-loop
      const scans = await DevicePunch.find({ employee: log.employee, timestamp: { $gte: start, $lt: end } }).sort({ timestamp: 1 }).select('timestamp').lean();
      const last = scans.length >= 2 ? scans[scans.length - 1].timestamp : null;
      lastScan.set(k, last && istParts(last).hour >= 12 ? last : null);
    }
    const last = lastScan.get(k);
    if (!last) continue;
    if (log.endedAt > last && log.startedAt < last) {
      // eslint-disable-next-line no-await-in-loop
      await close(log, last, 'left');
      trimmed += 1;
    }
  }
  return trimmed;
}

module.exports = { current, start, stop, day, team, forTicket, add, edit, remove, autoStop, trimToScans, dayBounds, measure };
