const crypto = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const WeeklyEvent = require('../models/WeeklyEvent');
const WeeklySeries = require('../models/WeeklySeries');
const User = require('../models/User');
const WorkTeam = require('../models/WorkTeam');
const AttendanceRecord = require('../models/AttendanceRecord');
const holidayRepository = require('../repositories/holiday.repository');
const notificationService = require('./notification.service');
const emailService = require('./email.service');
const ticketService = require('./ticket.service');
const accessService = require('./access.service');
const { can } = require('../utils/roles');
const { ACCESS } = require('../config/access');
const {
  USER_ROLES,
  EMPLOYEE_STATUS,
  ATTENDANCE_STATUS,
  NOTIFICATION_TYPES,
  WEEKLY_INVITE_STATUS,
  WEEKLY_NOTE_KIND,
  WEEKLY_GRID,
  WEEKLY_REPEAT,
  FEATURES,
} = require('../config/constants');

// ---------------------------------------------------------------------------
// Weekly Calendar — everyone's Mon–Sun planner of meetings and events.
//
// Rules, in one place:
//  * A slot is held by the host and by attendees who ACCEPTED. A pending
//    invite is "tentative" and never blocks anyone.
//  * A meeting can be split into time slices, each given to one person. A
//    guest with a slice holds only their slice; the host holds it all.
//  * Nobody can be invited to (or accept, or join) something that clashes
//    with time they already hold, or a day they're on leave.
//  * Lunch (1:30–2:30 pm) is marked on the grid but can be booked.
//  * An event can repeat every week, month or year until the host stops it
//    (models/WeeklySeries.js). Its dates are made a year ahead and topped up
//    nightly; a date the host is busy on is skipped, and a guest busy on a
//    date isn't invited to that one.
//  * Past days are read-only, except that notes can still be added.
//  * Someone else's time shows only as "Busy" — unless you're in that
//    event, it's open for all, or you're admin (admin sees everything).
// ---------------------------------------------------------------------------

const { INVITED, ACCEPTED, DECLINED } = WEEKLY_INVITE_STATUS;
const IST_OFFSET_MIN = 330;

const idOf = (value) => (value?._id ?? value)?.toString();

// ---- Days & times (IST) ----------------------------------------------------

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(day) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sun
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}

function nowIst() {
  const shifted = new Date(Date.now() + IST_OFFSET_MIN * 60_000);
  return { day: shifted.toISOString().slice(0, 10), min: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

function fmtMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function fmtDay(day) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const fmtWhen = (o) => `${fmtDay(o.day)}, ${fmtMin(o.startMin)} – ${fmtMin(o.endMin)}`;

// UTC instant of an IST day + minute — for calendar (.ics) attachments.
function toUtc(day, min) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + (min - IST_OFFSET_MIN) * 60_000);
}

const overlaps = (a, b) => a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin;

const pad2 = (n) => String(n).padStart(2, '0');
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1–12
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

// Every date a repeating time lands on, from its first date (`anchorDay`),
// within [fromDay, toDay]. Monthly and yearly keep the same date and skip a
// month or year that hasn't got it (the 31st, 29 Feb).
function repeatDates(anchorDay, repeat, fromDay, toDay) {
  const out = [];
  const from = fromDay > anchorDay ? fromDay : anchorDay;
  if (repeat === WEEKLY_REPEAT.WEEKLY) {
    const skip = Math.max(0, Math.ceil(daysBetween(anchorDay, from) / 7));
    for (let d = addDays(anchorDay, 7 * skip); d <= toDay; d = addDays(d, 7)) out.push(d);
    return out;
  }
  const [y0, m0, dom] = anchorDay.split('-').map(Number);
  const step = repeat === WEEKLY_REPEAT.YEARLY ? 12 : 1;
  for (let y = y0, m = m0; `${y}-${pad2(m)}-01` <= toDay; ) {
    if (dom <= daysInMonth(y, m)) {
      const day = `${y}-${pad2(m)}-${pad2(dom)}`;
      if (day >= from && day <= toDay) out.push(day);
    }
    m += step;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
  }
  return out;
}

// How far ahead a repeating event's dates are made.
const REPEAT_AHEAD_DAYS = { weekly: 365, monthly: 365, yearly: 3 * 365 + 1 };
const repeatHorizon = (repeat) => addDays(nowIst().day, REPEAT_AHEAD_DAYS[repeat]);

const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ordinal = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const joinAnd = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`);

// "Every week on Monday & Wednesday", "Every month on the 15th",
// "Every year on 15 Oct".
function repeatLabel(series) {
  const days = [...new Set(series.slots.map((s) => s.anchorDay))].sort();
  if (series.repeat === WEEKLY_REPEAT.WEEKLY) {
    const dows = [...new Set(days.map((d) => new Date(`${d}T00:00:00Z`).getUTCDay()))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    return `Every week on ${joinAnd(dows.map((d) => DOW_LONG[d]))}`;
  }
  if (series.repeat === WEEKLY_REPEAT.MONTHLY) {
    const doms = [...new Set(days.map((d) => Number(d.slice(8))))].sort((a, b) => a - b);
    return `Every month on the ${joinAnd(doms.map(ordinal))}`;
  }
  return `Every year on ${joinAnd(days.map((d) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`))}`;
}

// The lines an email shows for a repeating series — one per repeating time.
function repeatLines(series, fromDay) {
  const label = repeatLabel(series);
  const times = [...new Set(series.slots.map((s) => `${fmtMin(s.startMin)} – ${fmtMin(s.endMin)}`))];
  return [`${label}, ${joinAnd(times)}`, `From ${fmtDay(fromDay)} — repeats until the host stops it`];
}

function assertOccurrence(o, { allowPast = false } = {}) {
  if (!DAY_RE.test(o.day)) throw ApiError.badRequest('Invalid day');
  const { START, END, SLOT } = WEEKLY_GRID;
  if (o.startMin % SLOT || o.endMin % SLOT || o.startMin < START || o.endMin > END || o.endMin <= o.startMin) {
    throw ApiError.badRequest('Pick whole slots between 6:30 am and 8:30 pm');
  }
  if (!allowPast) {
    const now = nowIst();
    if (o.day < now.day || (o.day === now.day && o.endMin <= now.min)) {
      throw ApiError.badRequest(`${fmtWhen(o)} has already passed`);
    }
  }
}

// ---- People ------------------------------------------------------------------

const ROLE_LABEL = {
  admin: 'Admin',
  hr: 'HR',
  ceo: 'CEO',
  cto: 'CTO',
  cfo: 'CFO',
  digital_admin: 'Digital Admin',
  operations_manager: 'Operations Manager',
  team_lead: 'Team Lead',
  sales: 'Sales',
  technical: 'Technical',
  finance: 'Finance',
  worker: 'Employee',
};

const titleCase = (s) => (s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();

function companyEmailOf(employee) {
  const entry = (employee?.extraDetails || []).find((d) => d.key && d.key.trim().toUpperCase() === 'COMPANY MAIL ID');
  return entry?.value?.trim() || null;
}

function toPerson(user) {
  const employee = user.employeeLink && typeof user.employeeLink === 'object' ? user.employeeLink : null;
  const name = employee ? titleCase(`${employee.firstName} ${employee.lastName ?? ''}`) : ROLE_LABEL[user.role] && user.role !== 'worker' ? ROLE_LABEL[user.role] : user.username;
  return {
    _id: idOf(user._id),
    name,
    subtitle: employee ? titleCase(employee.designation) || ROLE_LABEL[user.role] : `${ROLE_LABEL[user.role] ?? user.role} · ${user.username}`,
    role: user.role,
    employeeId: employee ? idOf(employee._id) : null,
    email: employee ? companyEmailOf(employee) : null,
  };
}

// Everyone who can hold a calendar: every active login. A bare "worker"
// login with no employee record is a test account — it can use its own
// calendar but isn't offered as someone to invite. Cached briefly: nearly
// every request needs it and the roster changes rarely.
const PEOPLE_TTL_MS = 60_000;
let peopleCache = null;

function loadPeople() {
  if (peopleCache && peopleCache.expires > Date.now()) return peopleCache.promise;
  const promise = fetchPeople().catch((err) => {
    peopleCache = null;
    throw err;
  });
  peopleCache = { promise, expires: Date.now() + PEOPLE_TTL_MS };
  return promise;
}

async function fetchPeople() {
  // A role login (ceo, hr…) isn't offered as an invitee when a real person
  // holds that post — invite the person instead.
  const org = await accessService.orgMap();
  const heldRoles = new Set([...org.rolesByEmployee.values()].flatMap((roles) => [...roles]));
  const users = await User.find({ isActive: true })
    .populate('employeeLink', 'firstName lastName designation extraDetails status isDeleted')
    .lean();
  const people = new Map();
  for (const user of users) {
    const employee = user.employeeLink;
    if (employee && (employee.isDeleted || employee.status !== EMPLOYEE_STATUS.ACTIVE)) continue;
    const person = toPerson(user);
    person.listed = employee ? true : user.role !== USER_ROLES.WORKER && !heldRoles.has(user.role);
    people.set(person._id, person);
  }
  return people;
}

const publicPerson = (p) => p && { _id: p._id, name: p.name, subtitle: p.subtitle, role: p.role, hasEmail: Boolean(p.email) };
const personOrGone = (people, id) => publicPerson(people.get(idOf(id))) ?? { _id: idOf(id), name: 'Former member', subtitle: '', role: '', hasEmail: false };

async function listPeople() {
  const [people, teams] = await Promise.all([loadPeople(), WorkTeam.find({ isDeleted: { $ne: true } }).lean()]);
  const userByEmployee = new Map([...people.values()].filter((p) => p.employeeId).map((p) => [p.employeeId, p._id]));
  const groups = [];
  const contentManagers = new Set();
  for (const team of teams.sort((a, b) => a.name.localeCompare(b.name))) {
    const ids = [team.leader, ...(team.members || [])].map((e) => userByEmployee.get(idOf(e))).filter(Boolean);
    if (ids.length) groups.push({ key: `team:${team._id}`, label: `${team.name} team`, userIds: [...new Set(ids)] });
    for (const mr of team.memberRoles || []) {
      if ((mr.roles || []).includes('content_manager') && userByEmployee.get(idOf(mr.employee))) {
        contentManagers.add(userByEmployee.get(idOf(mr.employee)));
      }
    }
  }
  if (contentManagers.size) groups.push({ key: 'role:content_manager', label: 'All Content Managers', userIds: [...contentManagers] });
  const leadership = [...people.values()].filter((p) => ['ceo', 'cto', 'cfo', 'hr', 'admin', 'operations_manager', 'team_lead'].includes(p.role));
  if (leadership.length) groups.push({ key: 'role:leadership', label: 'Leadership & HR', userIds: leadership.map((p) => p._id) });

  return {
    people: [...people.values()].filter((p) => p.listed).map(publicPerson).sort((a, b) => a.name.localeCompare(b.name)),
    groups,
  };
}

// ---- Busy time -------------------------------------------------------------------

const wholeOf = (event) => ({ day: event.day, startMin: event.startMin, endMin: event.endMin });

// The slices of a meeting given to this person.
const slicesOf = (event, userId) =>
  (event.segments || []).filter((s) => s.user && idOf(s.user) === userId).map((s) => ({ day: event.day, startMin: s.startMin, endMin: s.endMin }));

// The time this person has (or would have) in an event: the host all of it;
// a guest their own slices if the meeting is split and they have one,
// otherwise all of it.
function piecesFor(event, userId) {
  if (idOf(event.host) === userId) return [wholeOf(event)];
  const mine = slicesOf(event, userId);
  return mine.length ? mine : [wholeOf(event)];
}

// The time it actually holds on their calendar — nothing until they accept.
function heldPieces(event, userId) {
  if (idOf(event.host) === userId) return [wholeOf(event)];
  const a = event.attendees.find((x) => idOf(x.user) === userId);
  return a?.status === ACCEPTED ? piecesFor(event, userId) : [];
}

// Every interval each user holds between two days (inclusive): events they
// host or accepted (just their slice, if they have one), and whole days
// they're on approved leave.
async function busyIntervals(userIds, fromDay, toDay, { excludeEventIds = [] } = {}) {
  const ids = [...new Set(userIds.map(idOf))];
  const out = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return out;
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

  const [events, users] = await Promise.all([
    WeeklyEvent.find({
      day: { $gte: fromDay, $lte: toDay },
      cancelledAt: null,
      _id: { $nin: excludeEventIds.map((id) => new mongoose.Types.ObjectId(idOf(id))) },
      $or: [{ host: { $in: objectIds } }, { attendees: { $elemMatch: { user: { $in: objectIds }, status: ACCEPTED } } }],
    }).lean(),
    User.find({ _id: { $in: objectIds }, employeeLink: { $ne: null } }).select('employeeLink').lean(),
  ]);
  for (const event of events) {
    for (const id of ids) {
      for (const piece of heldPieces(event, id)) out.get(id).push({ kind: 'event', ...piece, event });
    }
  }

  if (users.length) {
    const userByEmployee = new Map(users.map((u) => [idOf(u.employeeLink), idOf(u._id)]));
    const leave = await AttendanceRecord.find({
      employee: { $in: users.map((u) => u.employeeLink) },
      date: { $gte: new Date(`${fromDay}T00:00:00Z`), $lte: new Date(`${toDay}T00:00:00Z`) },
      status: ATTENDANCE_STATUS.PAID_LEAVE,
    })
      .select('employee date')
      .lean();
    for (const record of leave) {
      const userId = userByEmployee.get(idOf(record.employee));
      out.get(userId)?.push({ kind: 'leave', day: record.date.toISOString().slice(0, 10), startMin: WEEKLY_GRID.START, endMin: WEEKLY_GRID.END });
    }
  }
  return out;
}

// Every clash per user: `wanted` is the times to check — the same list for
// everyone, or (userId) => that person's own times (their slices).
async function allConflicts(userIds, wanted, { excludeEventIds } = {}) {
  const ids = [...new Set(userIds.map(idOf))];
  const wants = new Map(ids.map((id) => [id, typeof wanted === 'function' ? wanted(id) : wanted]));
  const days = [...wants.values()].flat().map((o) => o.day).sort();
  if (!days.length) return new Map();
  const busy = await busyIntervals(ids, days[0], days[days.length - 1], { excludeEventIds });
  const conflicts = new Map();
  for (const [userId, intervals] of busy) {
    const hits = [];
    for (const o of wants.get(userId)) {
      const hit = intervals.find((b) => overlaps(b, o));
      if (hit) hits.push({ occurrence: o, interval: hit });
    }
    if (hits.length) conflicts.set(userId, hits);
  }
  return conflicts;
}

// First clash per user, or nothing.
async function findConflicts(userIds, wanted, options) {
  const all = await allConflicts(userIds, wanted, options);
  return new Map([...all].map(([id, hits]) => [id, hits[0]]));
}

function describeConflict(conflict, viewer, people, subjectId) {
  const { occurrence, interval } = conflict;
  const when = fmtWhen(occurrence);
  if (interval.kind === 'leave') return `on leave on ${fmtDay(occurrence.day)}`;
  const canSee = isAdmin(viewer) || subjectId === viewer.id || canViewEvent(interval.event, viewer);
  const what = canSee ? `"${interval.event.title}"` : 'something else';
  return `busy at ${when} (${what})`;
}

async function assertAllFree(viewer, userIds, wanted, { selfMessage, people, excludeEventIds } = {}) {
  const conflicts = await findConflicts(userIds, wanted, { excludeEventIds });
  if (!conflicts.size) return;
  const all = people ?? (await loadPeople());
  const lines = [...conflicts].map(([userId, c]) => {
    const who = userId === viewer.id ? selfMessage ?? 'You are' : `${all.get(userId)?.name ?? 'Someone'} is`;
    return `${who} ${describeConflict(c, viewer, all, userId)}`;
  });
  throw ApiError.conflict(lines.join('; '));
}

// ---- Access & shaping ------------------------------------------------------------

// Sees every title, personal ones included — admin only (config/access.js).
const isAdmin = (viewer) => can(viewer, ACCESS.CALENDAR_SEE_ALL);
const attendeeOf = (event, userId) => event.attendees.find((a) => idOf(a.user) === userId);
const isHost = (event, viewer) => idOf(event.host) === viewer.id;

function canViewEvent(event, viewer) {
  if (isAdmin(viewer) || isHost(event, viewer)) return true;
  if (event.isPersonal) return false;
  return Boolean(attendeeOf(event, viewer.id)) || event.openForAll;
}

// Host, anyone invited (not declined), or admin — who may read/write notes.
function isMember(event, viewer) {
  if (isAdmin(viewer) || isHost(event, viewer)) return true;
  const a = attendeeOf(event, viewer.id);
  return Boolean(a && a.status !== DECLINED);
}

function assertCanManage(event, viewer) {
  if (!isHost(event, viewer) && !isAdmin(viewer)) throw ApiError.forbidden('Only the host can change this event');
}

// `forUser` is whose calendar it's shown on (the viewer, or a colleague
// being looked at): `held` is their own slices when they have one — the
// grid shows just that time for them.
function shapeEvent(event, viewer, people, { forUser = viewer.id } = {}) {
  const own = idOf(event.host) === forUser ? [] : slicesOf(event, forUser);
  const base = {
    _id: idOf(event._id),
    day: event.day,
    startMin: event.startMin,
    endMin: event.endMin,
    held: own.length ? own.map(({ startMin, endMin }) => ({ startMin, endMin })) : null,
  };
  if (!canViewEvent(event, viewer)) return { ...base, busy: true };
  const mine = attendeeOf(event, viewer.id);
  return {
    ...base,
    busy: false,
    repeat: event.repeatInfo ?? null,
    slot: event.slot ?? null,
    title: event.title,
    description: event.description ?? '',
    category: event.category,
    isPersonal: event.isPersonal,
    openForAll: event.openForAll,
    location: event.location ?? '',
    link: event.link ?? '',
    series: event.series ? idOf(event.series) : null,
    seriesSize: event.seriesSize ?? 1,
    host: personOrGone(people, event.host),
    attendees: event.attendees.map((a) => ({
      user: personOrGone(people, a.user),
      status: a.status,
      invitedAt: a.invitedAt,
      respondedAt: a.respondedAt,
      reason: a.reason ?? '',
    })),
    myRole: isHost(event, viewer) ? 'host' : mine ? mine.status : event.openForAll ? 'open' : 'viewer',
    canManage: isHost(event, viewer) || isAdmin(viewer),
    canNote: isMember(event, viewer),
    segments: (event.segments || [])
      .slice()
      .sort((a, b) => a.startMin - b.startMin)
      .map((s) => ({ _id: idOf(s._id), startMin: s.startMin, endMin: s.endMin, label: s.label ?? '', user: s.user ? personOrGone(people, s.user) : null })),
    notes: isMember(event, viewer)
      ? (event.notes || []).map((n) => ({
          _id: idOf(n._id),
          kind: n.kind,
          text: n.text,
          createdBy: personOrGone(people, n.createdBy),
          createdAt: n.createdAt,
          updatedBy: n.updatedBy ? personOrGone(people, n.updatedBy) : null,
          updatedAt: n.updatedAt,
          history: (n.history || []).map((h) => ({ text: h.text, by: personOrGone(people, h.by), at: h.at })),
          assignee: n.assignee ? personOrGone(people, n.assignee) : null,
          dueDay: n.dueDay ?? null,
          done: Boolean(n.done),
          task: n.task ? idOf(n.task) : null,
          ticket: n.ticket ? { _id: idOf(n.ticket), code: n.ticketCode || null } : null,
        }))
      : [],
    cancelledAt: event.cancelledAt ?? null,
  };
}

// How many dates each event's series has, and how it repeats (if it does).
async function withSeriesSize(events) {
  const seriesIds = [...new Set(events.filter((e) => e.series).map((e) => idOf(e.series)))];
  if (!seriesIds.length) return events;
  const objectIds = seriesIds.map((id) => new mongoose.Types.ObjectId(id));
  const [counts, rules] = await Promise.all([
    WeeklyEvent.aggregate([{ $match: { series: { $in: objectIds }, cancelledAt: null } }, { $group: { _id: '$series', n: { $sum: 1 } } }]),
    WeeklySeries.find({ _id: { $in: objectIds } }).lean(),
  ]);
  const byId = new Map(counts.map((c) => [idOf(c._id), c.n]));
  const ruleById = new Map(rules.map((r) => [idOf(r._id), { repeat: r.repeat, label: repeatLabel(r), ended: Boolean(r.endedAt) }]));
  return events.map((e) => (e.series ? { ...e, seriesSize: byId.get(idOf(e.series)) ?? 1, repeatInfo: ruleById.get(idOf(e.series)) ?? null } : e));
}

const loadRule = (event) => (event.series ? WeeklySeries.findById(event.series) : null);

async function loadEvent(id) {
  const event = await WeeklyEvent.findById(id);
  if (!event || event.cancelledAt) throw ApiError.notFound('This event no longer exists');
  return event;
}

// ---- Notifications & email -------------------------------------------------------

const hrFrom = () => env.resend.fromEmail; // "HR <hr@gotofriend.in>"
const hrAddress = () => env.hrNotificationEmail || /<([^>]+)>/.exec(env.resend.fromEmail || '')?.[1] || undefined;

// Links in emails must open on the recipient's own phone or laptop — a
// localhost/private address can't, and mail filters treat such links as a
// strong spam signal. Until PUBLIC_APP_URL points at the deployed app,
// emails go out without links and tell people to reply inside the EMS.
const PRIVATE_HOST = /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|\.local$/i;
let warnedNoPublicUrl = false;

function appLink(path) {
  let host = '';
  try {
    host = new URL(env.publicAppUrl).hostname;
  } catch {
    host = '';
  }
  if (!host || PRIVATE_HOST.test(host)) {
    if (!warnedNoPublicUrl) {
      logger.warn({ publicAppUrl: env.publicAppUrl }, 'PUBLIC_APP_URL is not a public address — calendar emails are sent without links');
      warnedNoPublicUrl = true;
    }
    return null;
  }
  return `${env.publicAppUrl}${path}`;
}

// Invite links carry a short signed token: which event, which person, and
// whether a reply covers the whole series — HMAC-signed so it can't be
// forged or edited. (Older long JWT links are still accepted.)
const inviteSecret = () => `${env.jwtSecret}:weekly-invite`;
const b64url = (buf) => Buffer.from(buf).toString('base64url');

function makeInviteToken(eventId, userId, scope) {
  const payload = Buffer.concat([Buffer.from(idOf(eventId), 'hex'), Buffer.from(idOf(userId), 'hex'), Buffer.from([scope === 'series' ? 1 : 0])]);
  const sig = crypto.createHmac('sha256', inviteSecret()).update(payload).digest().subarray(0, 16);
  return `${b64url(payload)}.${b64url(sig)}`;
}

function readInviteToken(token) {
  const invalid = () => ApiError.badRequest('This invite link is invalid or has expired');
  if (token.split('.').length === 3) {
    try {
      const payload = jwt.verify(token, inviteSecret());
      if (payload.typ !== 'weekly-invite') throw new Error('wrong token');
      return payload;
    } catch {
      throw invalid();
    }
  }
  const [p, sig] = token.split('.');
  const payload = Buffer.from(p || '', 'base64url');
  if (payload.length !== 25 || !sig) throw invalid();
  const expected = crypto.createHmac('sha256', inviteSecret()).update(payload).digest().subarray(0, 16);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw invalid();
  return { e: payload.subarray(0, 12).toString('hex'), u: payload.subarray(12, 24).toString('hex'), s: payload[24] === 1 ? 'series' : 'one' };
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A plain "add to my calendar" file (METHOD:PUBLISH) — a well-formed file
// that every calendar app opens. Deliberately not a meeting REQUEST: that
// format needs organiser/attendee details, and replies would go to the HR
// inbox instead of the EMS.
// A repeating series becomes one repeating entry per repeating time (an
// RRULE) — calendar apps skip the months without a 31st just like we do.
function icsFor(events, rule) {
  const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const fold = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GoToFriend//Weekly Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const entries = rule
    ? rule.slots
        .map((s, i) => ({ s, i, first: events.find((e) => (e.slot ?? 0) === i) }))
        .filter((x) => x.first)
        .map(({ s, i, first }) => {
          const [, m, d] = first.day.split('-').map(Number);
          const rrule =
            rule.repeat === WEEKLY_REPEAT.WEEKLY
              ? 'RRULE:FREQ=WEEKLY'
              : rule.repeat === WEEKLY_REPEAT.MONTHLY
                ? `RRULE:FREQ=MONTHLY;BYMONTHDAY=${d}`
                : `RRULE:FREQ=YEARLY;BYMONTH=${m};BYMONTHDAY=${d}`;
          return { uid: `${idOf(rule._id)}-${i}`, day: first.day, startMin: s.startMin, endMin: s.endMin, extra: [rrule], e: first };
        })
    : events.map((e) => ({ uid: idOf(e._id), day: e.day, startMin: e.startMin, endMin: e.endMin, extra: [], e }));
  for (const { uid, day, startMin, endMin, extra, e } of entries) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}@gotofriend.in`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(toUtc(day, startMin))}`,
      `DTEND:${stamp(toUtc(day, endMin))}`,
      ...extra,
      `SUMMARY:${fold(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${fold(e.description)}`] : []),
      ...(e.location ? [`LOCATION:${fold(e.location)}`] : []),
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return Buffer.from(lines.join('\r\n')).toString('base64');
}

// What an email lists under the title: each date, or for a repeating
// series how it repeats.
const whenLines = (occurrences, rule) => (rule ? repeatLines(rule, occurrences[0].day) : occurrences.map(fmtWhen));

const FOOTER = "You're receiving this because someone at GoToFriend added you to a meeting on the company's Weekly Calendar.";

function emailShell({ preheader, heading, intro, event, lines, buttons = '', fallback = '' }) {
  const rows = lines
    .map((line) => `<tr><td style="padding:7px 0;border-top:1px solid #eef0f6;font-size:14px;color:#1e293b">${esc(line)}</td></tr>`)
    .join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f5fb;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fb"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e8f2;border-radius:16px">
  <tr><td style="padding:22px 26px;background:#5b5bd6;border-radius:16px 16px 0 0;color:#ffffff">
    <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase">Weekly Calendar</div>
    <div style="font-size:22px;font-weight:bold;margin-top:4px">${esc(heading)}</div>
  </td></tr>
  <tr><td style="padding:22px 26px">
    <p style="margin:0 0 14px;font-size:14px;line-height:20px;color:#334155">${intro}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e8f2;border-radius:12px"><tr><td style="padding:14px 16px">
      <div style="font-size:18px;font-weight:bold;color:#0f172a">${esc(event.title)}</div>
      ${event.description ? `<div style="margin-top:6px;font-size:13px;line-height:19px;color:#475569;white-space:pre-line">${esc(event.description)}</div>` : ''}
      ${event.location ? `<div style="margin-top:6px;font-size:13px;color:#475569">Where: ${esc(event.location)}</div>` : ''}
      ${event.link ? `<div style="margin-top:6px;font-size:13px">Meeting link: <a href="${esc(event.link)}" style="color:#4f46e5">${esc(event.link)}</a></div>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">${rows}</table>
    </td></tr></table>
    ${buttons ? `<div style="margin-top:22px;text-align:center">${buttons}</div>` : ''}
    ${fallback ? `<p style="margin:18px 0 0;font-size:14px;line-height:20px;color:#334155">${fallback}</p>` : ''}
    <p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#94a3b8">${FOOTER} Questions? Just reply to this email.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function emailText({ heading, intro, event, lines, links = [], fallback = '' }) {
  return [
    heading,
    '',
    intro,
    '',
    event.title,
    ...(event.description ? [event.description] : []),
    ...(event.location ? [`Where: ${event.location}`] : []),
    ...(event.link ? [`Meeting link: ${event.link}`] : []),
    '',
    ...lines.map((line) => `- ${line}`),
    '',
    ...links.map(([label, href]) => `${label}: ${href}`),
    ...(fallback ? [fallback] : []),
    '',
    `${FOOTER} Questions? Just reply to this email.`,
  ].join('\n');
}

const button = (href, label, color) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:0 6px;padding:12px 26px;border-radius:999px;background:${color};color:#ffffff;font-weight:bold;font-size:14px;text-decoration:none">${label}</a>`;

async function safeEmail(args) {
  try {
    await emailService.sendEmail({ from: hrFrom(), replyTo: hrAddress(), ...args });
  } catch (err) {
    logger.error({ err, to: args.to, subject: args.subject }, 'Weekly calendar email failed');
  }
}

// One at a time with a short gap — Resend caps requests per second, and a
// burst of parallel sends gets throttled.
async function sendEach(items, send) {
  for (const item of items) {
    await send(item);
    await new Promise((r) => setTimeout(r, 300));
  }
}

// One invite per person, covering every occurrence they were invited to
// (`occurrences` are the saved event docs, one per date). A repeating
// series (`rule`) is described by how it repeats, not date by date.
async function sendInvites(event, occurrences, userIds, people, { inviterId, scope, rescheduled = false, rule = null }) {
  const host = people.get(idOf(event.host));
  const inviter = people.get(idOf(inviterId)) ?? host;
  const whenFor = (list) =>
    rule ? `${repeatLabel(rule).replace(/^Every/, 'every')} from ${fmtDay(list[0].day)}` : list.length === 1 ? fmtWhen(list[0]) : `${list.length} dates from ${fmtDay(list[0].day)}`;
  const theirs = (userId) => {
    const list = occurrences.filter((o) => (o.attendees || []).some((a) => idOf(a.user) === idOf(userId)));
    return list.length ? list : occurrences;
  };
  const slotLine = (userId, list) => {
    const mine = slicesOf(list[0], idOf(userId));
    return mine.length ? ` Your slot: ${mine.map((s) => `${fmtMin(s.startMin)} – ${fmtMin(s.endMin)}`).join(', ')}.` : '';
  };
  for (const userId of userIds) {
    const list = theirs(userId);
    await notificationService.createForUsers([idOf(userId)], {
      type: NOTIFICATION_TYPES.WEEKLY_INVITE,
      title: rescheduled ? `Rescheduled: ${event.title}` : `Invite: ${event.title}`,
      message: `${inviter?.name ?? 'Someone'} ${rescheduled ? 'moved this to' : 'invited you —'} ${whenFor(list)}.${slotLine(userId, list)} Open Weekly Calendar to accept or decline.`,
      weeklyEvent: event._id,
    });
  }

  await sendEach(userIds, async (userId) => {
    const person = people.get(idOf(userId));
    if (!person?.email) return;
    const list = theirs(userId);
    const when = whenFor(list);
    const slot = slotLine(userId, list);
    const first = person.name.split(' ')[0];
    const base = appLink(`/calendar-invite/${makeInviteToken(event._id, userId, scope)}`);
    const fallback = base ? '' : 'To accept or decline, open the Weekly Calendar in the EMS — the invite is waiting under Invites.';
    const heading = rescheduled ? 'A meeting was rescheduled' : "You're invited";
    const introText = rescheduled
      ? `Hi ${first}, ${inviter?.name} moved this meeting. Please confirm the new time.${slot}`
      : `Hi ${first}, ${inviter?.name} has invited you to join${host && inviter && host._id !== inviter._id ? ` ${host.name}'s` : ''}:${slot}`;
    const introHtml = rescheduled
      ? `Hi ${esc(first)}, <b>${esc(inviter?.name)}</b> moved this meeting. Please confirm the new time.${slot ? `<br/><b>${esc(slot.trim())}</b>` : ''}`
      : `Hi ${esc(first)}, <b>${esc(inviter?.name)}</b> has invited you to join${host && inviter && host._id !== inviter._id ? ` ${esc(host.name)}'s` : ''}:${slot ? `<br/><b>${esc(slot.trim())}</b>` : ''}`;
    const links = base
      ? [
          ['Accept', `${base}?action=accept`],
          ['Decline', `${base}?action=decline`],
        ]
      : [];
    const lines = whenLines(list, rule);
    await safeEmail({
      to: person.email,
      subject: `${rescheduled ? 'Rescheduled' : 'Invitation'}: ${event.title} (${when})`,
      html: emailShell({
        preheader: `${inviter?.name} invited you — ${when}`,
        heading,
        intro: introHtml,
        event,
        lines,
        buttons: links.map(([label, href]) => button(href, label, label === 'Accept' ? '#16a34a' : '#e11d48')).join(''),
        fallback,
      }),
      text: emailText({ heading, intro: introText, event, lines, links, fallback }),
      attachments: [{ filename: 'invite.ics', content: icsFor(list, rule) }],
    });
  });
}

async function notifyCancelled(events, people, viewer, reason, rule = null) {
  const first = events[0];
  const recipients = new Set();
  for (const e of events) for (const a of e.attendees) if (a.status !== DECLINED) recipients.add(idOf(a.user));
  recipients.delete(viewer.id);
  if (!recipients.size) return;
  const when = rule
    ? `${repeatLabel(rule).replace(/^Every/, 'every')} from ${fmtDay(first.day)} (it won't repeat any more)`
    : events.length === 1
      ? fmtWhen(first)
      : `${events.length} dates from ${fmtDay(first.day)}`;
  const lines = rule ? [`${repeatLabel(rule)} — stopped from ${fmtDay(first.day)}`] : events.map(fmtWhen);
  await notificationService.createForUsers([...recipients], {
    type: NOTIFICATION_TYPES.WEEKLY_EVENT_CANCELLED,
    title: `Cancelled: ${first.title}`,
    message: `${people.get(viewer.id)?.name ?? 'The host'} cancelled ${when}.${reason ? ` Reason: ${reason}` : ''}`,
    weeklyEvent: first._id,
  });
  await sendEach([...recipients], async (userId) => {
    const person = people.get(userId);
    if (!person?.email) return;
    const name = person.name.split(' ')[0];
    const introText = `Hi ${name}, this has been cancelled, so the time is free on your calendar again.${reason ? ` Reason: ${reason}` : ''}`;
    await safeEmail({
      to: person.email,
      subject: `Cancelled: ${first.title} (${when})`,
      html: emailShell({
        preheader: `Cancelled — ${when}`,
        heading: 'Meeting cancelled',
        intro: `Hi ${esc(name)}, this has been cancelled, so the time is free on your calendar again.${reason ? `<br/><i>${esc(reason)}</i>` : ''}`,
        event: first,
        lines,
      }),
      text: emailText({ heading: 'Meeting cancelled', intro: introText, event: first, lines }),
    });
  });
}

// ---- Reads ---------------------------------------------------------------------------

async function getWeek(viewer, { start, userId }) {
  const weekStart = mondayOf(start || nowIst().day);
  const weekEnd = addDays(weekStart, 6);
  const target = userId || viewer.id;
  const self = target === viewer.id;
  const targetId = new mongoose.Types.ObjectId(target);

  const or = [{ host: targetId }, { attendees: { $elemMatch: { user: targetId, status: self ? { $ne: DECLINED } : ACCEPTED } } }];
  if (self) or.push({ openForAll: true });
  const [people, raw] = await Promise.all([
    loadPeople(),
    WeeklyEvent.find({ day: { $gte: weekStart, $lte: weekEnd }, cancelledAt: null, $or: or }).sort({ day: 1, startMin: 1 }).lean(),
  ]);
  const events = (await withSeriesSize(raw)).map((e) => shapeEvent(e, viewer, people, { forUser: target }));

  const [holidays, busy] = await Promise.all([
    holidayRepository.list({ from: new Date(`${weekStart}T00:00:00Z`), to: new Date(`${weekEnd}T00:00:00Z`) }),
    busyIntervals([target], weekStart, weekEnd),
  ]);
  return {
    start: weekStart,
    days: Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    today: nowIst().day,
    nowMin: nowIst().min,
    person: personOrGone(people, target),
    events,
    holidays: holidays.map((h) => ({ day: h.date.toISOString().slice(0, 10), label: h.label, type: h.type })),
    leaveDays: [...new Set((busy.get(target) || []).filter((b) => b.kind === 'leave').map((b) => b.day))],
    grid: WEEKLY_GRID,
  };
}

// Busy intervals for many people over a week — powers the "who's free"
// picker and Find a time. Titles only where the viewer may see them.
async function getBusy(viewer, { start, userIds }) {
  const weekStart = mondayOf(start || nowIst().day);
  const weekEnd = addDays(weekStart, 6);
  const people = await loadPeople();
  const ids = userIds?.length ? userIds : [...people.values()].filter((p) => p.listed).map((p) => p._id);
  const [busy, tentative] = await Promise.all([
    busyIntervals(ids, weekStart, weekEnd),
    WeeklyEvent.find({
      day: { $gte: weekStart, $lte: weekEnd },
      cancelledAt: null,
      attendees: { $elemMatch: { user: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) }, status: INVITED } },
    }).lean(),
  ]);

  const result = {};
  for (const id of ids) {
    result[id] = (busy.get(id) || []).map((b) => ({
      kind: b.kind,
      day: b.day,
      startMin: b.startMin,
      endMin: b.endMin,
      eventId: b.event ? idOf(b.event._id) : null,
      title: b.event && (id === viewer.id || canViewEvent(b.event, viewer)) ? b.event.title : null,
    }));
    for (const e of tentative) {
      if (e.attendees.some((a) => idOf(a.user) === id && a.status === INVITED)) {
        for (const piece of piecesFor(e, id)) {
          result[id].push({ kind: 'tentative', ...piece, eventId: idOf(e._id), title: canViewEvent(e, viewer) || id === viewer.id ? e.title : null });
        }
      }
    }
  }
  return { start: weekStart, busy: result };
}

async function getEvent(viewer, id) {
  const event = await WeeklyEvent.findById(id).lean();
  if (!event) throw ApiError.notFound('This event no longer exists');
  const people = await loadPeople();
  const [withSize] = await withSeriesSize([event]);
  const shaped = shapeEvent(withSize, viewer, people);
  if (shaped.busy) throw ApiError.forbidden("You can't see the details of this event");
  if (event.series) {
    const siblings = await WeeklyEvent.find({ series: event.series, cancelledAt: null }).sort({ day: 1, startMin: 1 }).select('day startMin endMin slot').lean();
    shaped.occurrences = siblings.map((s) => ({ _id: idOf(s._id), day: s.day, startMin: s.startMin, endMin: s.endMin, slot: s.slot ?? null }));
  }
  return shaped;
}

// Pending invites — one per series (its next date), with how many of its
// dates are still waiting for an answer.
async function listMyInvites(viewer) {
  const people = await loadPeople();
  const events = await WeeklyEvent.find({
    day: { $gte: nowIst().day },
    cancelledAt: null,
    attendees: { $elemMatch: { user: new mongoose.Types.ObjectId(viewer.id), status: INVITED } },
  })
    .sort({ day: 1, startMin: 1 })
    .lean();
  const pending = new Map();
  const firsts = [];
  for (const e of events) {
    const key = e.series ? idOf(e.series) : idOf(e._id);
    if (!pending.has(key)) firsts.push(e);
    pending.set(key, (pending.get(key) ?? 0) + 1);
  }
  return (await withSeriesSize(firsts)).map((e) => ({
    ...shapeEvent(e, viewer, people),
    pendingCount: pending.get(e.series ? idOf(e.series) : idOf(e._id)),
  }));
}

// ---- Writes ------------------------------------------------------------------------------

const byTime = (a, b) => a.day.localeCompare(b.day) || a.startMin - b.startMin;

function assertNoSelfOverlap(occurrences) {
  const sorted = [...occurrences].sort(byTime);
  for (let i = 1; i < sorted.length; i += 1) {
    if (overlaps(sorted[i - 1], sorted[i])) throw ApiError.badRequest(`Two of the chosen times overlap each other (${fmtDay(sorted[i].day)})`);
  }
}

// Slices come in as minutes from the meeting's start, so one split fits
// every date. Each must sit inside every picked time, without overlapping.
function checkSlices(slices, lengths, members) {
  const sorted = [...(slices || [])].sort((a, b) => a.start - b.start);
  const shortest = Math.min(...lengths);
  sorted.forEach((s, i) => {
    if (s.start < 0 || s.end <= s.start || s.end > shortest) throw ApiError.badRequest('Every slice must sit inside the meeting time');
    if (i > 0 && s.start < sorted[i - 1].end) throw ApiError.badRequest('Two slices overlap');
    if (s.user && !members.has(idOf(s.user))) throw ApiError.badRequest('A slice can only go to someone in this meeting');
  });
  return sorted.map((s) => ({ start: s.start, end: s.end, label: s.label || undefined, user: s.user ? idOf(s.user) : undefined }));
}

const slicesAt = (slices, startMin) =>
  (slices || []).map((s) => ({ startMin: startMin + s.start, endMin: startMin + s.end, label: s.label, user: s.user }));

// One of a series' dates, ready to insert.
function occurrenceDoc(fields, o, { host, series, slices, attendees }) {
  return {
    title: fields.title,
    description: fields.description,
    category: fields.category,
    isPersonal: fields.isPersonal,
    openForAll: fields.openForAll,
    location: fields.location,
    link: fields.link,
    day: o.day,
    startMin: o.startMin,
    endMin: o.endMin,
    slot: o.slot,
    host,
    series,
    segments: slicesAt(slices, o.startMin),
    attendees,
  };
}

const busyNote = (people, userId, hits) =>
  `${people.get(userId)?.name ?? 'Someone'} is busy on ${hits.length === 1 ? fmtWhen(hits[0].occurrence) : `${hits.length} of the dates (first ${fmtWhen(hits[0].occurrence)})`} — not invited to ${hits.length === 1 ? 'that one' : 'those'}`;

async function createEvent(viewer, data) {
  const repeat = Object.values(WEEKLY_REPEAT).includes(data.repeat) ? data.repeat : null;
  const slots = [...new Map(data.slots.map((s) => [`${s.day}:${s.startMin}`, { day: s.day, startMin: s.startMin, endMin: s.endMin }])).values()].sort(byTime);
  if (repeat && slots.length > 7) throw ApiError.badRequest('A repeating event can have up to 7 times');
  slots.forEach((o) => assertOccurrence(o));
  assertNoSelfOverlap(slots);

  const people = await loadPeople();
  const isPersonal = Boolean(data.isPersonal);
  const invitees = isPersonal ? [] : [...new Set((data.invitees || []).map(idOf))].filter((id) => id !== viewer.id);
  const unknown = invitees.filter((id) => !people.get(id)?.listed);
  if (unknown.length) throw ApiError.badRequest('Some of the people picked are no longer active');
  const slices = isPersonal ? [] : checkSlices(data.slices, slots.map((s) => s.endMin - s.startMin), new Set([viewer.id, ...invitees]));

  // Every date: the picked times, or each one repeated up to a year ahead.
  const occurrences = repeat
    ? slots.flatMap((s, i) => repeatDates(s.day, repeat, s.day, repeatHorizon(repeat)).map((day) => ({ day, startMin: s.startMin, endMin: s.endMin, slot: i }))).sort(byTime)
    : slots;
  assertNoSelfOverlap(occurrences);

  const fields = {
    title: data.title,
    description: data.description,
    category: data.category,
    isPersonal,
    openForAll: isPersonal ? false : Boolean(data.openForAll),
    location: data.location,
    link: data.link,
  };
  const piecesOn = (o, userId) => slicesOf({ day: o.day, segments: slicesAt(slices, o.startMin) }, userId);
  const guestWants = (o) => (userId) => {
    const mine = piecesOn(o, userId);
    return mine.length ? mine : [o];
  };

  // A one-off: everyone must be free, or nothing is made. A repeating one
  // skips the dates the host is busy on, and doesn't invite a guest to the
  // dates they're busy on.
  const skipped = [];
  let dates = occurrences;
  const busyGuestDates = new Map();
  if (!repeat) {
    await assertAllFree(viewer, [viewer.id], occurrences, { selfMessage: 'You are', people });
    await assertAllFree(viewer, invitees, (userId) => occurrences.flatMap((o) => guestWants(o)(userId)), { people });
  } else {
    const mine = (await allConflicts([viewer.id], occurrences)).get(viewer.id) ?? [];
    const clash = new Set(mine.map((h) => `${h.occurrence.day}:${h.occurrence.startMin}`));
    dates = occurrences.filter((o) => !clash.has(`${o.day}:${o.startMin}`));
    if (!dates.length) throw ApiError.conflict(`You are ${describeConflict(mine[0], viewer, people, viewer.id)}`);
    if (mine.length) skipped.push(`${mine.length === 1 ? fmtDay(mine[0].occurrence.day) : `${mine.length} dates`} left out — you're busy then (first: ${fmtWhen(mine[0].occurrence)})`);
    const guests = await allConflicts(invitees, (userId) => dates.flatMap((o) => guestWants(o)(userId)));
    for (const [userId, hits] of guests) {
      busyGuestDates.set(userId, hits);
      skipped.push(busyNote(people, userId, hits));
    }
  }

  const series = dates.length > 1 || repeat ? new mongoose.Types.ObjectId() : undefined;
  const now = new Date();
  const attendeesOn = (o) =>
    invitees
      .filter((u) => !(busyGuestDates.get(u) || []).some((h) => overlaps(h.occurrence, o)))
      .map((user) => ({ user, status: INVITED, invitedBy: viewer.id, invitedAt: now }));
  let rule = null;
  if (repeat) {
    rule = await WeeklySeries.create({
      _id: series,
      repeat,
      host: viewer.id,
      ...fields,
      slots: slots.map((s) => ({ anchorDay: s.day, startMin: s.startMin, endMin: s.endMin })),
      slices,
      attendees: invitees.map((user) => ({ user, status: INVITED, invitedBy: viewer.id, invitedAt: now })),
      generatedUntil: repeatHorizon(repeat),
    });
  }
  const docs = await WeeklyEvent.insertMany(dates.map((o) => occurrenceDoc(fields, o, { host: viewer.id, series, slices, attendees: attendeesOn(o) })));

  if (invitees.length) {
    sendInvites(docs[0], docs, invitees, people, { inviterId: viewer.id, scope: series ? 'series' : 'one', rule }).catch((err) =>
      logger.error({ err }, 'sendInvites failed')
    );
  }
  return { events: docs.slice(0, 20).map((d) => shapeEvent(d.toObject(), viewer, people)), count: docs.length, skipped };
}

// The occurrences an action applies to: just this one, or this and every
// later one in its series that hasn't happened yet.
async function scopedEvents(event, scope) {
  if (scope !== 'series' || !event.series) return [event];
  const today = nowIst().day;
  return WeeklyEvent.find({ series: event.series, cancelledAt: null, day: { $gte: event.day < today ? today : event.day } }).sort({ day: 1, startMin: 1 });
}

// A date moved to new hours keeps its slices in the same place relative to
// the start; any that no longer fit are dropped. Everyone has to confirm
// the new time again.
function placeAt(doc, next) {
  const shift = next.startMin - doc.startMin;
  doc.segments = (doc.segments || [])
    .map((s) => ({ startMin: s.startMin + shift, endMin: s.endMin + shift, label: s.label, user: s.user }))
    .filter((s) => s.endMin <= next.endMin);
  doc.day = next.day;
  doc.startMin = next.startMin;
  doc.endMin = next.endMin;
  doc.reminderSentAt = undefined;
  for (const a of doc.attendees) {
    if (a.status === ACCEPTED) {
      a.status = INVITED;
      a.respondedAt = undefined;
    }
  }
}

// "This & all upcoming": the dates of this repeating time move together.
// A repeating series re-plans them from the new first date (a monthly one
// moved to the 31st only keeps months that have one).
async function moveSeries(viewer, event, next, people) {
  const rule = await loadRule(event);
  const stream = (await scopedEvents(event, 'series')).filter((t) =>
    rule ? (t.slot ?? 0) === (event.slot ?? 0) : t.startMin === event.startMin && t.endMin === event.endMin
  );
  if (idOf(stream[0]?._id) !== idOf(event._id)) throw ApiError.badRequest('This date has already passed');
  const dayShift = daysBetween(event.day, next.day);
  const times = { startMin: next.startMin, endMin: next.endMin };
  const moved = rule
    ? repeatDates(next.day, rule.repeat, next.day, rule.endedAt ? stream[stream.length - 1].day : rule.generatedUntil).map((day) => ({ day, ...times, slot: event.slot }))
    : stream.map((t) => ({ day: addDays(t.day, dayShift), ...times }));
  moved.forEach((o) => assertOccurrence(o));
  assertNoSelfOverlap(moved);
  await assertAllFree(viewer, [idOf(event.host)], moved, {
    selfMessage: isHost(event, viewer) ? 'You are' : 'The host is',
    people,
    excludeEventIds: stream.map((t) => t._id),
  });

  const pairs = Math.min(stream.length, moved.length);
  for (let i = 0; i < pairs; i += 1) {
    placeAt(stream[i], moved[i]);
    await stream[i].save();
  }
  const leftover = stream.slice(pairs);
  if (leftover.length) {
    await WeeklyEvent.updateMany(
      { _id: { $in: leftover.map((t) => t._id) } },
      { $set: { cancelledAt: new Date(), cancelledBy: viewer.id, cancelReason: 'Moved to a new time' } }
    );
  }
  const template = stream[0].toObject();
  const extra = moved.slice(pairs).map((o) => ({
    ...occurrenceDoc(template, o, { host: template.host, series: template.series, slices: [], attendees: [] }),
    segments: slicesAt((template.segments || []).map((s) => ({ start: s.startMin - template.startMin, end: s.endMin - template.startMin, label: s.label, user: s.user })), o.startMin),
    attendees: template.attendees.map(({ user, status, invitedBy, invitedAt, reason }) => ({ user, status, invitedBy, invitedAt, reason })),
  }));
  const added = extra.length ? await WeeklyEvent.insertMany(extra) : [];

  if (rule) {
    rule.slots.set(event.slot ?? 0, { anchorDay: next.day, ...times });
    const length = next.endMin - next.startMin;
    rule.slices = rule.slices.filter((s) => s.end <= length);
    for (const a of rule.attendees) if (a.status === ACCEPTED) a.status = INVITED;
    await rule.save();
  }
  const dates = [...stream.slice(0, pairs), ...added];
  const toNotify = [...new Set(dates.flatMap((d) => d.attendees.filter((a) => a.status === INVITED).map((a) => idOf(a.user))))];
  if (toNotify.length) {
    sendInvites(dates[0], dates, toNotify, people, { inviterId: viewer.id, scope: 'series', rescheduled: true, rule }).catch((err) =>
      logger.error({ err }, 'reschedule invites failed')
    );
  }
}

async function updateEvent(viewer, id, data) {
  const event = await loadEvent(id);
  assertCanManage(event, viewer);
  const people = await loadPeople();
  const { scope = 'one', ...fields } = data;

  const timeChange =
    (fields.day && fields.day !== event.day) ||
    (fields.startMin != null && fields.startMin !== event.startMin) ||
    (fields.endMin != null && fields.endMin !== event.endMin);

  if (timeChange) {
    const next = { day: fields.day ?? event.day, startMin: fields.startMin ?? event.startMin, endMin: fields.endMin ?? event.endMin };
    if (scope === 'series' && event.series) {
      await moveSeries(viewer, event, next, people);
      return getEvent(viewer, id);
    }
    assertOccurrence(next);
    await assertAllFree(viewer, [idOf(event.host)], [next], {
      selfMessage: isHost(event, viewer) ? 'You are' : 'The host is',
      people,
      excludeEventIds: [event._id],
    });
    placeAt(event, next);
    await event.save();
    const toNotify = event.attendees.filter((a) => a.status === INVITED).map((a) => idOf(a.user));
    if (toNotify.length) {
      sendInvites(event, [event], toNotify, people, { inviterId: viewer.id, scope: 'one', rescheduled: true }).catch((err) =>
        logger.error({ err }, 'reschedule invites failed')
      );
    }
    return getEvent(viewer, id);
  }

  const editable = ['title', 'description', 'category', 'location', 'link', 'openForAll'];
  const patch = Object.fromEntries(editable.filter((k) => fields[k] !== undefined).map((k) => [k, fields[k]]));
  if (event.isPersonal && patch.openForAll) throw ApiError.badRequest('A personal block cannot be open for all');
  const targets = await scopedEvents(event, scope);
  await WeeklyEvent.updateMany({ _id: { $in: targets.map((t) => t._id) } }, { $set: patch });
  // New dates of a repeating series are copied from its rule.
  if (scope === 'series' && event.series) await WeeklySeries.updateOne({ _id: event.series }, { $set: patch });

  const changedVisible = ['title', 'location', 'link'].some((k) => patch[k] !== undefined && patch[k] !== event[k]);
  if (changedVisible) {
    const recipients = [...new Set(targets.flatMap((t) => t.attendees.filter((a) => a.status !== DECLINED).map((a) => idOf(a.user))))].filter(
      (u) => u !== viewer.id
    );
    notificationService.createForUsers(recipients, {
      type: NOTIFICATION_TYPES.WEEKLY_EVENT_UPDATED,
      title: `Updated: ${patch.title ?? event.title}`,
      message: `${people.get(viewer.id)?.name ?? 'The host'} updated the details of ${fmtWhen(event)}.`,
      weeklyEvent: event._id,
    });
  }
  return getEvent(viewer, id);
}

// Cancelling "this & all upcoming" of a repeating series also stops it
// repeating.
async function cancelEvent(viewer, id, { scope = 'one', reason }) {
  const event = await loadEvent(id);
  assertCanManage(event, viewer);
  const targets = await scopedEvents(event, scope);
  await WeeklyEvent.updateMany(
    { _id: { $in: targets.map((t) => t._id) } },
    { $set: { cancelledAt: new Date(), cancelledBy: viewer.id, cancelReason: reason } }
  );
  const rule = scope === 'series' ? await loadRule(event) : null;
  if (rule && !rule.endedAt) {
    rule.endedAt = new Date();
    rule.endedBy = viewer.id;
    await rule.save();
  }
  const people = await loadPeople();
  notifyCancelled(targets, people, viewer, reason, rule).catch((err) => logger.error({ err }, 'notifyCancelled failed'));
  return { cancelled: targets.length, stopped: Boolean(rule) };
}

// Invite more people. For several dates at once, anyone busy on some of
// them is invited to the rest (and that's reported back).
async function inviteMore(viewer, id, { userIds, scope = 'one' }) {
  const event = await loadEvent(id);
  assertCanManage(event, viewer);
  if (event.isPersonal) throw ApiError.badRequest("A personal block doesn't have guests");
  const people = await loadPeople();
  const targets = await scopedEvents(event, scope);
  const open = targets.filter((t) => {
    const now = nowIst();
    return t.day > now.day || (t.day === now.day && t.endMin > now.min);
  });
  if (!open.length) throw ApiError.badRequest('This event has already finished');

  const fresh = [...new Set(userIds.map(idOf))].filter((u) => u !== idOf(event.host) && people.get(u)?.listed);
  const toInvite = fresh.filter((u) => open.some((t) => !attendeeOf(t, u) || attendeeOf(t, u).status === DECLINED));
  if (!toInvite.length) throw ApiError.badRequest('Everyone picked is already invited');
  const wants = (u) => open.flatMap((t) => piecesFor(t, u).map((p) => ({ ...p, eventId: idOf(t._id) })));
  const skipped = [];
  let busyOn = new Map();
  if (open.length === 1) {
    await assertAllFree(viewer, toInvite, wants, { people });
  } else {
    busyOn = await allConflicts(toInvite, wants);
    for (const [u, hits] of busyOn) skipped.push(busyNote(people, u, hits));
  }

  const now = new Date();
  const changed = [];
  for (const t of open) {
    let touched = false;
    for (const u of toInvite) {
      if ((busyOn.get(u) || []).some((h) => h.occurrence.eventId === idOf(t._id))) continue;
      const existing = attendeeOf(t, u);
      if (existing && existing.status !== DECLINED) continue;
      if (existing) Object.assign(existing, { status: INVITED, invitedBy: viewer.id, invitedAt: now, respondedAt: undefined, reason: undefined });
      else t.attendees.push({ user: u, status: INVITED, invitedBy: viewer.id, invitedAt: now });
      touched = true;
    }
    if (touched) changed.push(t);
  }
  if (!changed.length) throw ApiError.conflict(skipped.join('; ') || 'Everyone picked is already invited');
  await Promise.all(changed.map((t) => t.save()));

  const rule = scope === 'series' ? await loadRule(event) : null;
  if (rule) {
    for (const u of toInvite) {
      const existing = rule.attendees.find((a) => idOf(a.user) === u);
      if (existing) Object.assign(existing, { status: INVITED, invitedBy: viewer.id, invitedAt: now, respondedAt: undefined });
      else rule.attendees.push({ user: u, status: INVITED, invitedBy: viewer.id, invitedAt: now });
    }
    await rule.save();
  }
  const invited = toInvite.filter((u) => changed.some((t) => attendeeOf(t, u)?.status === INVITED));
  sendInvites(event, changed, invited, people, { inviterId: viewer.id, scope, rule }).catch((err) => logger.error({ err }, 'sendInvites failed'));
  return { event: await getEvent(viewer, id), skipped };
}

async function removeAttendee(viewer, id, userId, { scope = 'one' } = {}) {
  const event = await loadEvent(id);
  assertCanManage(event, viewer);
  const targets = await scopedEvents(event, scope);
  for (const t of targets) {
    t.attendees = t.attendees.filter((a) => idOf(a.user) !== userId);
    t.segments = (t.segments || []).filter((s) => idOf(s.user) !== userId);
  }
  await Promise.all(targets.map((t) => t.save()));
  if (scope === 'series' && event.series) {
    await WeeklySeries.updateOne({ _id: event.series }, { $pull: { attendees: { user: userId }, slices: { user: userId } } });
  }
  const people = await loadPeople();
  notificationService.createForUsers([userId], {
    type: NOTIFICATION_TYPES.WEEKLY_EVENT_CANCELLED,
    title: `Removed from: ${event.title}`,
    message: `${people.get(viewer.id)?.name ?? 'The host'} took you off ${fmtWhen(event)} — the time is free again.`,
    weeklyEvent: event._id,
  });
  return getEvent(viewer, id);
}

// Accept or decline — for this one, or every upcoming date in the series.
// On a series accept, dates that clash are skipped (and reported) rather
// than failing the whole thing.
async function respond(viewer, id, { response, reason, scope = 'one' }) {
  const event = await loadEvent(id);
  const mine = attendeeOf(event, viewer.id);
  if (!mine) throw ApiError.forbidden("You aren't invited to this event");
  const targets = (await scopedEvents(event, scope)).filter((t) => attendeeOf(t, viewer.id));
  const people = await loadPeople();
  const skipped = [];
  const done = [];

  // Checked in one go — a series can have a year of dates. Only their own
  // slice has to be free when they have one.
  const waiting = response === 'accept' ? targets.filter((t) => attendeeOf(t, viewer.id).status !== ACCEPTED) : targets;
  let clashes = new Map();
  if (response === 'accept' && waiting.length) {
    const wants = waiting.flatMap((t) => piecesFor(t, viewer.id).map((p) => ({ ...p, eventId: idOf(t._id) })));
    const hits = (await allConflicts([viewer.id], wants, { excludeEventIds: waiting.map((t) => t._id) })).get(viewer.id) ?? [];
    clashes = new Map(hits.map((h) => [h.occurrence.eventId, h]));
  }
  for (const t of waiting) {
    const a = attendeeOf(t, viewer.id);
    if (response === 'accept') {
      const hit = clashes.get(idOf(t._id));
      if (hit) {
        skipped.push(`${fmtWhen(t)} — you're ${describeConflict(hit, viewer, people, viewer.id)}`);
        continue;
      }
      a.status = ACCEPTED;
    } else {
      a.status = DECLINED;
      a.reason = reason;
    }
    a.respondedAt = new Date();
    done.push(t);
  }
  await Promise.all(done.map((t) => t.save()));

  if (response === 'accept' && !done.length && skipped.length) throw ApiError.conflict(`Couldn't accept: ${skipped.slice(0, 5).join('; ')}`);

  // Answering for the whole series also answers for the dates it adds later.
  if (scope === 'series' && event.series && done.length) {
    await WeeklySeries.updateOne(
      { _id: event.series, 'attendees.user': new mongoose.Types.ObjectId(viewer.id) },
      { $set: { 'attendees.$.status': response === 'accept' ? ACCEPTED : DECLINED, 'attendees.$.respondedAt': new Date() } }
    );
  }

  if (done.length && !isHost(event, viewer)) {
    const me = people.get(viewer.id)?.name ?? 'Someone';
    const when = done.length === 1 ? fmtWhen(done[0]) : `${done.length} dates`;
    notificationService.createForUsers([idOf(event.host)], {
      type: NOTIFICATION_TYPES.WEEKLY_INVITE_RESPONSE,
      title: `${me} ${response === 'accept' ? 'accepted' : 'declined'}: ${event.title}`,
      message: `${when}${response === 'decline' && reason ? ` — "${reason}"` : ''}`,
      weeklyEvent: event._id,
    });
  }
  return { updated: done.length, skipped };
}

async function join(viewer, id) {
  const event = await loadEvent(id);
  if (!event.openForAll) throw ApiError.forbidden('This event is invite-only');
  if (isHost(event, viewer)) throw ApiError.badRequest("You're hosting this");
  assertOccurrence(event);
  const people = await loadPeople();
  await assertAllFree(viewer, [viewer.id], piecesFor(event, viewer.id), { selfMessage: 'You are', people, excludeEventIds: [event._id] });
  const existing = attendeeOf(event, viewer.id);
  if (existing) Object.assign(existing, { status: ACCEPTED, respondedAt: new Date() });
  else event.attendees.push({ user: viewer.id, status: ACCEPTED, invitedBy: viewer.id, respondedAt: new Date() });
  await event.save();
  return getEvent(viewer, id);
}

const membersOf = (event) => new Set([idOf(event.host), ...event.attendees.filter((a) => a.status !== DECLINED).map((a) => idOf(a.user))]);

// Split a meeting into slices — this date, or this and every upcoming date
// (the same split, from each date's start; a slice for someone who isn't in
// a particular date is left out there). Taking someone's slice away gives
// them the whole meeting again, so that time has to be free for them.
async function setSegments(viewer, id, segments, { scope = 'one' } = {}) {
  const event = await loadEvent(id);
  assertCanManage(event, viewer);
  const members = membersOf(event);
  const sorted = [...segments].sort((a, b) => a.startMin - b.startMin);
  sorted.forEach((s, i) => {
    if (s.startMin < event.startMin || s.endMin > event.endMin || s.endMin <= s.startMin) {
      throw ApiError.badRequest(`Every slice must sit inside ${fmtMin(event.startMin)} – ${fmtMin(event.endMin)}`);
    }
    if (i > 0 && s.startMin < sorted[i - 1].endMin) throw ApiError.badRequest('Two slices overlap');
    if (s.user && !members.has(idOf(s.user))) throw ApiError.badRequest('A slice can only go to someone in this meeting');
  });
  const relative = sorted.map((s) => ({ start: s.startMin - event.startMin, end: s.endMin - event.startMin, label: s.label || undefined, user: s.user ? idOf(s.user) : undefined }));

  const targets = scope === 'series' ? await scopedEvents(event, 'series') : [event];
  if (!targets.some((t) => idOf(t._id) === idOf(event._id))) targets.unshift(event);
  const next = new Map(
    targets.map((t) => {
      const here = membersOf(t);
      const fits = relative.filter((s) => s.end <= t.endMin - t.startMin && (!s.user || here.has(s.user)));
      return [idOf(t._id), slicesAt(fits, t.startMin)];
    })
  );

  // Guests who accepted: is the time they'd now hold free?
  const accepted = [...new Set(targets.flatMap((t) => t.attendees.filter((a) => a.status === ACCEPTED).map((a) => idOf(a.user))))];
  const wants = (u) =>
    targets.filter((t) => attendeeOf(t, u)?.status === ACCEPTED).flatMap((t) => piecesFor({ ...t.toObject(), segments: next.get(idOf(t._id)) }, u));
  const people = await loadPeople();
  await assertAllFree(viewer, accepted, wants, { people, excludeEventIds: targets.map((t) => t._id) });

  for (const t of targets) t.segments = next.get(idOf(t._id));
  await Promise.all(targets.map((t) => t.save()));
  if (scope === 'series' && event.series) await WeeklySeries.updateOne({ _id: event.series }, { $set: { slices: relative } });
  return getEvent(viewer, id);
}

// ---- Meeting notes ------------------------------------------------------------------------

async function noteContext(viewer, id) {
  const event = await WeeklyEvent.findById(id);
  if (!event) throw ApiError.notFound('This event no longer exists');
  if (!isMember(event, viewer)) throw ApiError.forbidden('Only people in this meeting can see or add notes');
  return event;
}

async function addNote(viewer, id, { kind = WEEKLY_NOTE_KIND.NOTE, text, assignee, dueDay }) {
  const event = await noteContext(viewer, id);
  event.notes.push({ kind, text, createdBy: viewer.id, assignee: kind === WEEKLY_NOTE_KIND.ACTION ? assignee : undefined, dueDay });
  await event.save();
  if (kind === WEEKLY_NOTE_KIND.ACTION && assignee && idOf(assignee) !== viewer.id) {
    const people = await loadPeople();
    notificationService.createForUsers([idOf(assignee)], {
      type: NOTIFICATION_TYPES.WEEKLY_NOTE_ADDED,
      title: `Action item for you: ${event.title}`,
      message: `${people.get(viewer.id)?.name ?? 'Someone'}: "${text.slice(0, 140)}"`,
      weeklyEvent: event._id,
    });
  }
  return getEvent(viewer, id);
}

async function updateNote(viewer, id, noteId, { text, done, assignee, dueDay }) {
  const event = await noteContext(viewer, id);
  const note = event.notes.id(noteId);
  if (!note) throw ApiError.notFound('Note not found');
  if (text !== undefined && text !== note.text) {
    note.history.push({ text: note.text, by: note.updatedBy ?? note.createdBy, at: note.updatedAt ?? note.createdAt });
    note.text = text;
  }
  if (done !== undefined) note.done = done;
  if (assignee !== undefined) note.assignee = assignee || undefined;
  if (dueDay !== undefined) note.dueDay = dueDay || undefined;
  note.updatedBy = viewer.id;
  await event.save();
  return getEvent(viewer, id);
}

async function deleteNote(viewer, id, noteId) {
  const event = await noteContext(viewer, id);
  const note = event.notes.id(noteId);
  if (!note) throw ApiError.notFound('Note not found');
  if (idOf(note.createdBy) !== viewer.id && !isHost(event, viewer) && !isAdmin(viewer)) {
    throw ApiError.forbidden('Only the person who wrote it, the host or admin can delete a note');
  }
  note.deleteOne();
  await event.save();
  return getEvent(viewer, id);
}

// An action item becomes a ticket (Simple pipeline) for its assignee in Task
// Management — raised by whoever presses the button, so the Organisation
// chart's rule applies: only for someone in their own box or below.
async function noteToTask(viewer, id, noteId) {
  if (!FEATURES.TASK_MANAGEMENT) throw ApiError.badRequest('Task Management is switched off for now');
  const event = await noteContext(viewer, id);
  const note = event.notes.id(noteId);
  if (!note) throw ApiError.notFound('Note not found');
  if (note.kind !== WEEKLY_NOTE_KIND.ACTION) throw ApiError.badRequest('Only action items can become tickets');
  if (note.task || note.ticket) throw ApiError.conflict('This action item is already a ticket');
  if (!note.assignee) throw ApiError.badRequest('Pick who the action item is for first');
  const assigneeUser = await User.findById(note.assignee).select('employeeLink');
  if (!assigneeUser?.employeeLink) throw ApiError.badRequest("This person has no employee record, so they can't get a ticket");

  const due = note.dueDay || addDays(nowIst().day > event.day ? nowIst().day : event.day, 2);
  const ticket = await ticketService.raise(viewer, {
    title: note.text.length > 120 ? `${note.text.slice(0, 117)}…` : note.text,
    description: `From the meeting "${event.title}" on ${fmtDay(event.day)}.\n\n${note.text}`,
    pipeline: 'simple',
    dueAt: toUtc(due, 18 * 60 + 30),
    raisedFor: assigneeUser.employeeLink,
  });
  note.ticket = ticket._id;
  note.ticketCode = ticket.code;
  note.updatedBy = viewer.id;
  await event.save();
  return getEvent(viewer, id);
}

// ---- Planning helpers ---------------------------------------------------------------------

// Copies everything you host in one week into another, re-inviting the same
// people. Anything that clashes, or is already in the past, is skipped — and
// so is anything that already repeats on its own.
async function copyWeek(viewer, { from, to }) {
  const fromStart = mondayOf(from);
  const toStart = mondayOf(to);
  if (fromStart === toStart) throw ApiError.badRequest('Pick a different week to copy into');
  const offset = Math.round((Date.parse(toStart) - Date.parse(fromStart)) / 86_400_000);
  const source = await withSeriesSize(
    await WeeklyEvent.find({ host: viewer.id, cancelledAt: null, day: { $gte: fromStart, $lte: addDays(fromStart, 6) } })
      .sort({ day: 1, startMin: 1 })
      .lean()
  );
  const people = await loadPeople();
  const created = [];
  const skipped = [];
  const seriesMap = new Map();

  for (const e of source) {
    const occ = { day: addDays(e.day, offset), startMin: e.startMin, endMin: e.endMin };
    if (e.repeatInfo) {
      skipped.push({ title: e.title, day: occ.day, reason: `Already repeats (${e.repeatInfo.label.toLowerCase()})` });
      continue;
    }
    try {
      assertOccurrence(occ);
      await assertAllFree(viewer, [viewer.id], [occ], { selfMessage: 'You are', people });
    } catch (err) {
      skipped.push({ title: e.title, day: occ.day, reason: err.message });
      continue;
    }
    const invitees = e.attendees.filter((a) => a.status !== DECLINED && people.get(idOf(a.user))?.listed).map((a) => idOf(a.user));
    const shift = { ...e, day: occ.day };
    const conflicts = await findConflicts(invitees, (u) => piecesFor(shift, u));
    const free = invitees.filter((u) => !conflicts.has(u));
    const busyNames = invitees.filter((u) => conflicts.has(u)).map((u) => people.get(u)?.name);
    if (busyNames.length) skipped.push({ title: e.title, day: occ.day, reason: `Not re-invited (busy): ${busyNames.join(', ')}` });

    let series;
    if (e.series) {
      if (!seriesMap.has(idOf(e.series))) seriesMap.set(idOf(e.series), new mongoose.Types.ObjectId());
      series = seriesMap.get(idOf(e.series));
    }
    const doc = await WeeklyEvent.create({
      title: e.title,
      description: e.description,
      category: e.category,
      isPersonal: e.isPersonal,
      openForAll: e.openForAll,
      location: e.location,
      link: e.link,
      ...occ,
      host: viewer.id,
      series,
      segments: (e.segments || [])
        .filter((s) => !s.user || idOf(s.user) === viewer.id || free.includes(idOf(s.user)))
        .map(({ startMin, endMin, label, user }) => ({ startMin, endMin, label, user })),
      attendees: free.map((user) => ({ user, status: INVITED, invitedBy: viewer.id })),
    });
    created.push(doc);
    if (free.length) {
      sendInvites(doc, [doc], free, people, { inviterId: viewer.id, scope: 'one' }).catch((err) => logger.error({ err }, 'sendInvites failed'));
    }
  }
  return { created: created.length, skipped };
}

// ---- Public invite links (from the email) ------------------------------------------------

async function getPublicInvite(token) {
  const { e, u, s } = readInviteToken(token);
  const event = await WeeklyEvent.findById(e).lean();
  if (!event) throw ApiError.notFound('This event no longer exists');
  const people = await loadPeople();
  const occurrences =
    s === 'series' && event.series
      ? await WeeklyEvent.find({
          series: event.series,
          cancelledAt: null,
          day: { $gte: nowIst().day },
          'attendees.user': new mongoose.Types.ObjectId(u),
        })
          .sort({ day: 1, startMin: 1 })
          .lean()
      : [event];
  const mine = attendeeOf(event, u);
  const rule = event.series ? await WeeklySeries.findById(event.series).lean() : null;
  const slot = slicesOf(event, u);
  return {
    title: event.title,
    description: event.description ?? '',
    category: event.category,
    location: event.location ?? '',
    link: event.link ?? '',
    host: personOrGone(people, event.host),
    invitee: personOrGone(people, u),
    cancelled: Boolean(event.cancelledAt),
    status: mine?.status ?? null,
    scope: s,
    repeat: rule ? `${repeatLabel(rule)}${rule.endedAt ? ' (stopped)' : ' — until the host stops it'}` : null,
    mySlot: slot.length ? slot.map(({ startMin, endMin }) => ({ startMin, endMin })) : null,
    total: occurrences.length,
    occurrences: occurrences.slice(0, 12).map((o) => ({ day: o.day, startMin: o.startMin, endMin: o.endMin, status: attendeeOf(o, u)?.status ?? null })),
    attendees: event.attendees.filter((a) => a.status === ACCEPTED).map((a) => personOrGone(people, a.user)),
  };
}

async function respondPublic(token, { response, reason }) {
  const { e, u, s } = readInviteToken(token);
  const user = await User.findById(u).select('role isActive');
  if (!user?.isActive) throw ApiError.forbidden('This account is no longer active');
  return respond({ id: u, role: user.role, roles: [user.role], access: [] }, e, { response, reason, scope: s });
}

// ---- Reminders & daily digest (jobs/weeklyCalendar.job.js) ------------------------------

// ~10 minutes before: the host and guests who hold the whole meeting are
// reminded at its start; a guest with a slice is reminded before their own
// slice instead.
async function sendDueReminders() {
  const now = nowIst();
  const window = { $gt: now.min, $lte: now.min + 10 };
  const due = await WeeklyEvent.find({
    day: now.day,
    cancelledAt: null,
    $or: [{ reminderSentAt: null, startMin: window }, { segments: { $elemMatch: { remindedAt: null, user: { $ne: null }, startMin: window } } }],
  });
  let sent = 0;
  for (const event of due) {
    const sliced = new Set((event.segments || []).filter((s) => s.user).map((s) => idOf(s.user)));
    const accepted = new Set(event.attendees.filter((a) => a.status === ACCEPTED).map((a) => idOf(a.user)));
    if (!event.reminderSentAt && event.startMin > now.min && event.startMin <= now.min + 10) {
      const recipients = [idOf(event.host), ...[...accepted].filter((u) => !sliced.has(u))];
      await notificationService.createForUsers(recipients, {
        type: NOTIFICATION_TYPES.WEEKLY_EVENT_REMINDER,
        title: `Starting at ${fmtMin(event.startMin)}: ${event.title}`,
        message: `${event.location ? `${event.location} · ` : ''}${fmtMin(event.startMin)} – ${fmtMin(event.endMin)}`,
        weeklyEvent: event._id,
      });
      event.reminderSentAt = new Date();
      sent += 1;
    }
    for (const s of event.segments || []) {
      if (!s.user || s.remindedAt || s.startMin <= now.min || s.startMin > now.min + 10) continue;
      s.remindedAt = new Date();
      const userId = idOf(s.user);
      if (!accepted.has(userId) || userId === idOf(event.host)) continue;
      await notificationService.createForUsers([userId], {
        type: NOTIFICATION_TYPES.WEEKLY_EVENT_REMINDER,
        title: `Your slot at ${fmtMin(s.startMin)}: ${event.title}`,
        message: `${event.location ? `${event.location} · ` : ''}${fmtMin(s.startMin)} – ${fmtMin(s.endMin)}${s.label ? ` · ${s.label}` : ''}`,
        weeklyEvent: event._id,
      });
      sent += 1;
    }
    await event.save();
  }
  return sent;
}

async function sendDailyDigests() {
  const today = nowIst().day;
  const events = await WeeklyEvent.find({ day: today, cancelledAt: null }).sort({ startMin: 1 }).lean();
  if (!events.length) return 0;
  const people = await loadPeople();
  const perUser = new Map();
  for (const e of events) {
    const holders = [idOf(e.host), ...e.attendees.filter((a) => a.status === ACCEPTED).map((a) => idOf(a.user))];
    for (const h of holders) {
      // Someone with a slice sees just their slice's time.
      const pieces = heldPieces(e, h).map((p) => ({ ...e, startMin: p.startMin, endMin: p.endMin }));
      perUser.set(h, [...(perUser.get(h) || []), ...pieces].sort((a, b) => a.startMin - b.startMin));
    }
  }
  const calendarLink = appLink('/calendar');
  let sent = 0;
  for (const [userId, list] of perUser) {
    const person = people.get(userId);
    if (!person?.email) continue;
    const name = person.name.split(' ')[0];
    const rows = list
      .map(
        (e) => `<tr><td style="padding:8px 10px;border-top:1px solid #eef0f6;font-size:13px;color:#4f46e5;font-weight:bold;white-space:nowrap">${fmtMin(e.startMin)} – ${fmtMin(e.endMin)}</td>
<td style="padding:8px 10px;border-top:1px solid #eef0f6;font-size:14px;color:#0f172a;font-weight:bold">${esc(e.title)}${e.location ? `<div style="font-size:12px;color:#64748b;font-weight:normal">${esc(e.location)}</div>` : ''}</td></tr>`
      )
      .join('');
    await safeEmail({
      to: person.email,
      subject: `Your day: ${list.length} on the calendar (${fmtDay(today)})`,
      html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Your day</title></head><body style="margin:0;background:#f4f5fb;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e8f2;border-radius:16px">
<tr><td style="padding:22px 26px;background:#5b5bd6;border-radius:16px 16px 0 0;color:#ffffff"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase">Weekly Calendar</div>
<div style="font-size:22px;font-weight:bold;margin-top:4px">Good morning, ${esc(name)}</div></td></tr>
<tr><td style="padding:18px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
${calendarLink ? `<p style="margin:18px 10px 0;font-size:13px"><a href="${esc(calendarLink)}" style="color:#4f46e5;font-weight:bold">Open your Weekly Calendar</a></p>` : ''}
<p style="margin:18px 10px 0;font-size:12px;line-height:18px;color:#94a3b8">${FOOTER}</p></td></tr></table></td></tr></table></body></html>`,
      text: [
        `Good morning, ${name}. Here is your day (${fmtDay(today)}):`,
        '',
        ...list.map((e) => `- ${fmtMin(e.startMin)} – ${fmtMin(e.endMin)}: ${e.title}${e.location ? ` (${e.location})` : ''}`),
        '',
        ...(calendarLink ? [`Open your Weekly Calendar: ${calendarLink}`] : []),
        FOOTER,
      ].join('\n'),
    });
    await new Promise((r) => setTimeout(r, 300));
    sent += 1;
  }
  return sent;
}

// Keeps every repeating series a year ahead (three for yearly). Run nightly
// and when the server starts, so a missed night is caught up. A new date
// the host is busy on is skipped (they're told); a guest who accepted the
// whole series is in each new date — unless they're busy then, when it
// waits as an invite for them to answer.
async function extendRepeats() {
  const rules = await WeeklySeries.find({ endedAt: null });
  let created = 0;
  for (const rule of rules) {
    const until = repeatHorizon(rule.repeat);
    if (rule.generatedUntil >= until) continue;
    const from = addDays(rule.generatedUntil, 1);
    const fresh = rule.slots
      .flatMap((s, i) => repeatDates(s.anchorDay, rule.repeat, from, until).map((day) => ({ day, startMin: s.startMin, endMin: s.endMin, slot: i })))
      .sort(byTime);
    rule.generatedUntil = until;
    if (!fresh.length) {
      await rule.save();
      continue;
    }
    const host = idOf(rule.host);
    const hostBusy = (await allConflicts([host], fresh)).get(host) ?? [];
    const dates = fresh.filter((o) => !hostBusy.some((h) => h.occurrence === o));
    const pieceOn = (o) => (u) => {
      const mine = slicesOf({ day: o.day, segments: slicesAt(rule.slices, o.startMin) }, u);
      return mine.length ? mine : [o];
    };
    const going = rule.attendees.filter((a) => a.status === ACCEPTED).map((a) => idOf(a.user));
    const guestBusy = await allConflicts(going, (u) => dates.flatMap((o) => pieceOn(o)(u)));
    const now = new Date();
    const docs = dates.map((o) =>
      occurrenceDoc(rule, o, {
        host: rule.host,
        series: rule._id,
        slices: rule.slices.filter((s) => !s.user || idOf(s.user) === host || rule.attendees.some((a) => idOf(a.user) === idOf(s.user) && a.status !== DECLINED)),
        attendees: rule.attendees.map((a) => {
          const busy = a.status === ACCEPTED && (guestBusy.get(idOf(a.user)) || []).some((h) => overlaps(h.occurrence, o));
          return { user: a.user, status: busy ? INVITED : a.status, invitedBy: a.invitedBy, invitedAt: a.invitedAt ?? now, respondedAt: busy ? undefined : a.respondedAt };
        }),
      })
    );
    if (docs.length) await WeeklyEvent.insertMany(docs);
    await rule.save();
    created += docs.length;

    if (hostBusy.length) {
      notificationService.createForUsers([host], {
        type: NOTIFICATION_TYPES.WEEKLY_EVENT_UPDATED,
        title: `Skipped ${hostBusy.length === 1 ? 'a date' : `${hostBusy.length} dates`}: ${rule.title}`,
        message: `You're busy on ${hostBusy.map((h) => fmtDay(h.occurrence.day)).slice(0, 4).join(', ')}${hostBusy.length > 4 ? '…' : ''}, so "${rule.title}" doesn't repeat then.`,
      });
    }
    for (const [u, hits] of guestBusy) {
      notificationService.createForUsers([u], {
        type: NOTIFICATION_TYPES.WEEKLY_INVITE,
        title: `Please check: ${rule.title}`,
        message: `You're busy on ${hits.map((h) => fmtDay(h.occurrence.day)).slice(0, 4).join(', ')}, so ${hits.length === 1 ? 'that date is' : 'those dates are'} waiting under Invites for you to answer.`,
      });
    }
    logger.info({ series: idOf(rule._id), added: docs.length, skipped: hostBusy.length }, 'Repeating calendar event extended');
  }
  return created;
}

module.exports = {
  // helpers (also used by the PDF renderer & tests)
  addDays,
  mondayOf,
  nowIst,
  fmtMin,
  fmtDay,
  loadPeople,
  repeatDates,
  repeatLabel,
  // reads
  listPeople,
  getWeek,
  getBusy,
  getEvent,
  listMyInvites,
  // writes
  createEvent,
  updateEvent,
  cancelEvent,
  inviteMore,
  removeAttendee,
  respond,
  join,
  setSegments,
  addNote,
  updateNote,
  deleteNote,
  noteToTask,
  copyWeek,
  // public links
  getPublicInvite,
  respondPublic,
  // jobs
  sendDueReminders,
  sendDailyDigests,
  extendRepeats,
};
