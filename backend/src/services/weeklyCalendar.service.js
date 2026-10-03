const crypto = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const WeeklyEvent = require('../models/WeeklyEvent');
const User = require('../models/User');
const WorkTeam = require('../models/WorkTeam');
const AttendanceRecord = require('../models/AttendanceRecord');
const holidayRepository = require('../repositories/holiday.repository');
const notificationService = require('./notification.service');
const emailService = require('./email.service');
const employeeTaskService = require('./employeeTask.service');
const {
  USER_ROLES,
  EMPLOYEE_STATUS,
  ATTENDANCE_STATUS,
  NOTIFICATION_TYPES,
  WEEKLY_INVITE_STATUS,
  WEEKLY_NOTE_KIND,
  WEEKLY_GRID,
  EMPLOYEE_TASK_TYPE,
} = require('../config/constants');

// ---------------------------------------------------------------------------
// Weekly Calendar — everyone's Mon–Sun planner of meetings and events.
//
// Rules, in one place:
//  * A slot is held by the host and by attendees who ACCEPTED. A pending
//    invite is "tentative" and never blocks anyone.
//  * Nobody can be invited to (or accept, or join) something that clashes
//    with time they already hold, or a day they're on leave.
//  * Lunch (1:30–2:30 pm) is a fixed company block — nothing is booked in it.
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

function assertOccurrence(o, { allowPast = false } = {}) {
  if (!DAY_RE.test(o.day)) throw ApiError.badRequest('Invalid day');
  const { START, END, SLOT, LUNCH_START, LUNCH_END } = WEEKLY_GRID;
  if (o.startMin % SLOT || o.endMin % SLOT || o.startMin < START || o.endMin > END || o.endMin <= o.startMin) {
    throw ApiError.badRequest('Pick whole slots between 6:30 am and 8:30 pm');
  }
  if (o.startMin < LUNCH_END && LUNCH_START < o.endMin) {
    throw ApiError.badRequest(`Lunch time (${fmtMin(LUNCH_START)} – ${fmtMin(LUNCH_END)}) can't be booked`);
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
  const users = await User.find({ isActive: true })
    .populate('employeeLink', 'firstName lastName designation extraDetails status isDeleted')
    .lean();
  const people = new Map();
  for (const user of users) {
    const employee = user.employeeLink;
    if (employee && (employee.isDeleted || employee.status !== EMPLOYEE_STATUS.ACTIVE)) continue;
    const person = toPerson(user);
    person.listed = Boolean(employee) || user.role !== USER_ROLES.WORKER;
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

const holdsTime = (event, userId) =>
  idOf(event.host) === userId || event.attendees.some((a) => idOf(a.user) === userId && a.status === ACCEPTED);

// Every interval each user holds between two days (inclusive): events they
// host or accepted, and whole days they're on approved leave.
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
      if (holdsTime(event, id)) {
        out.get(id).push({ kind: 'event', day: event.day, startMin: event.startMin, endMin: event.endMin, event });
      }
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

// First clash per user against any of `occurrences`, or nothing.
async function findConflicts(userIds, occurrences, options) {
  if (!occurrences.length) return new Map();
  const days = occurrences.map((o) => o.day).sort();
  const busy = await busyIntervals(userIds, days[0], days[days.length - 1], options);
  const conflicts = new Map();
  for (const [userId, intervals] of busy) {
    for (const o of occurrences) {
      const hit = intervals.find((b) => overlaps(b, o));
      if (hit) {
        conflicts.set(userId, { occurrence: o, interval: hit });
        break;
      }
    }
  }
  return conflicts;
}

function describeConflict(conflict, viewer, people, subjectId) {
  const { occurrence, interval } = conflict;
  const when = fmtWhen(occurrence);
  if (interval.kind === 'leave') return `on leave on ${fmtDay(occurrence.day)}`;
  const canSee = isAdmin(viewer) || subjectId === viewer.id || canViewEvent(interval.event, viewer);
  const what = canSee ? `"${interval.event.title}"` : 'something else';
  return `busy at ${when} (${what})`;
}

async function assertAllFree(viewer, userIds, occurrences, { selfMessage, people, excludeEventIds } = {}) {
  const conflicts = await findConflicts(userIds, occurrences, { excludeEventIds });
  if (!conflicts.size) return;
  const all = people ?? (await loadPeople());
  const lines = [...conflicts].map(([userId, c]) => {
    const who = userId === viewer.id ? selfMessage ?? 'You are' : `${all.get(userId)?.name ?? 'Someone'} is`;
    return `${who} ${describeConflict(c, viewer, all, userId)}`;
  });
  throw ApiError.conflict(lines.join('; '));
}

// ---- Access & shaping ------------------------------------------------------------

const isAdmin = (viewer) => viewer?.role === USER_ROLES.ADMIN;
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

function shapeEvent(event, viewer, people) {
  const base = { _id: idOf(event._id), day: event.day, startMin: event.startMin, endMin: event.endMin };
  if (!canViewEvent(event, viewer)) return { ...base, busy: true };
  const mine = attendeeOf(event, viewer.id);
  return {
    ...base,
    busy: false,
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
        }))
      : [],
    cancelledAt: event.cancelledAt ?? null,
  };
}

async function withSeriesSize(events) {
  const seriesIds = [...new Set(events.filter((e) => e.series).map((e) => idOf(e.series)))];
  if (!seriesIds.length) return events;
  const counts = await WeeklyEvent.aggregate([
    { $match: { series: { $in: seriesIds.map((id) => new mongoose.Types.ObjectId(id)) }, cancelledAt: null } },
    { $group: { _id: '$series', n: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [idOf(c._id), c.n]));
  return events.map((e) => (e.series ? { ...e, seriesSize: byId.get(idOf(e.series)) ?? 1 } : e));
}

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
function icsFor(events) {
  const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const fold = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GoToFriend//Weekly Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${idOf(e._id)}@gotofriend.in`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(toUtc(e.day, e.startMin))}`,
      `DTEND:${stamp(toUtc(e.day, e.endMin))}`,
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

const FOOTER = "You're receiving this because someone at GoToFriend added you to a meeting on the company's Weekly Calendar.";

function emailShell({ preheader, heading, intro, event, occurrences, buttons = '', fallback = '' }) {
  const rows = occurrences
    .map((o) => `<tr><td style="padding:7px 0;border-top:1px solid #eef0f6;font-size:14px;color:#1e293b">${esc(fmtWhen(o))}</td></tr>`)
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

function emailText({ heading, intro, event, occurrences, links = [], fallback = '' }) {
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
    ...occurrences.map((o) => `- ${fmtWhen(o)}`),
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
// (`occurrences` are the saved event docs, one per date).
async function sendInvites(event, occurrences, userIds, people, { inviterId, scope, rescheduled = false }) {
  const host = people.get(idOf(event.host));
  const inviter = people.get(idOf(inviterId)) ?? host;
  const when = occurrences.length === 1 ? fmtWhen(occurrences[0]) : `${occurrences.length} dates from ${fmtDay(occurrences[0].day)}`;
  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.WEEKLY_INVITE,
    title: rescheduled ? `Rescheduled: ${event.title}` : `Invite: ${event.title}`,
    message: `${inviter?.name ?? 'Someone'} ${rescheduled ? 'moved this to' : 'invited you —'} ${when}. Open Weekly Calendar to accept or decline.`,
    weeklyEvent: event._id,
  });

  await sendEach(userIds, async (userId) => {
    const person = people.get(idOf(userId));
    if (!person?.email) return;
    const first = person.name.split(' ')[0];
    const base = appLink(`/calendar-invite/${makeInviteToken(event._id, userId, scope)}`);
    const fallback = base ? '' : 'To accept or decline, open the Weekly Calendar in the EMS — the invite is waiting under Invites.';
    const heading = rescheduled ? 'A meeting was rescheduled' : "You're invited";
    const introText = rescheduled
      ? `Hi ${first}, ${inviter?.name} moved this meeting. Please confirm the new time.`
      : `Hi ${first}, ${inviter?.name} has invited you to join${host && inviter && host._id !== inviter._id ? ` ${host.name}'s` : ''}:`;
    const introHtml = rescheduled
      ? `Hi ${esc(first)}, <b>${esc(inviter?.name)}</b> moved this meeting. Please confirm the new time.`
      : `Hi ${esc(first)}, <b>${esc(inviter?.name)}</b> has invited you to join${host && inviter && host._id !== inviter._id ? ` ${esc(host.name)}'s` : ''}:`;
    const links = base
      ? [
          ['Accept', `${base}?action=accept`],
          ['Decline', `${base}?action=decline`],
        ]
      : [];
    await safeEmail({
      to: person.email,
      subject: `${rescheduled ? 'Rescheduled' : 'Invitation'}: ${event.title} (${when})`,
      html: emailShell({
        preheader: `${inviter?.name} invited you — ${when}`,
        heading,
        intro: introHtml,
        event,
        occurrences,
        buttons: links.map(([label, href]) => button(href, label, label === 'Accept' ? '#16a34a' : '#e11d48')).join(''),
        fallback,
      }),
      text: emailText({ heading, intro: introText, event, occurrences, links, fallback }),
      attachments: [{ filename: 'invite.ics', content: icsFor(occurrences) }],
    });
  });
}

async function notifyCancelled(events, people, viewer, reason) {
  const first = events[0];
  const recipients = new Set();
  for (const e of events) for (const a of e.attendees) if (a.status !== DECLINED) recipients.add(idOf(a.user));
  recipients.delete(viewer.id);
  if (!recipients.size) return;
  const when = events.length === 1 ? fmtWhen(first) : `${events.length} dates from ${fmtDay(first.day)}`;
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
        occurrences: events,
      }),
      text: emailText({ heading: 'Meeting cancelled', intro: introText, event: first, occurrences: events }),
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
  const events = (await withSeriesSize(raw)).map((e) => shapeEvent(e, viewer, people));

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
        result[id].push({ kind: 'tentative', day: e.day, startMin: e.startMin, endMin: e.endMin, eventId: idOf(e._id), title: canViewEvent(e, viewer) || id === viewer.id ? e.title : null });
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
    const siblings = await WeeklyEvent.find({ series: event.series, cancelledAt: null }).sort({ day: 1 }).select('day startMin endMin').lean();
    shaped.occurrences = siblings.map((s) => ({ _id: idOf(s._id), day: s.day, startMin: s.startMin, endMin: s.endMin }));
  }
  return shaped;
}

async function listMyInvites(viewer) {
  const people = await loadPeople();
  const events = await WeeklyEvent.find({
    day: { $gte: nowIst().day },
    cancelledAt: null,
    attendees: { $elemMatch: { user: new mongoose.Types.ObjectId(viewer.id), status: INVITED } },
  })
    .sort({ day: 1, startMin: 1 })
    .lean();
  return (await withSeriesSize(events)).map((e) => shapeEvent(e, viewer, people));
}

// ---- Writes ------------------------------------------------------------------------------

function expandOccurrences(slots, repeatWeeks) {
  const out = [];
  for (let w = 0; w <= (repeatWeeks || 0); w += 1) {
    for (const s of slots) out.push({ day: addDays(s.day, 7 * w), startMin: s.startMin, endMin: s.endMin });
  }
  const seen = new Set();
  return out
    .filter((o) => {
      const key = `${o.day}:${o.startMin}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.day.localeCompare(b.day) || a.startMin - b.startMin);
}

function assertNoSelfOverlap(occurrences) {
  for (let i = 0; i < occurrences.length; i += 1) {
    for (let j = i + 1; j < occurrences.length; j += 1) {
      if (overlaps(occurrences[i], occurrences[j])) throw ApiError.badRequest('Two of the chosen times overlap each other');
    }
  }
}

async function createEvent(viewer, data) {
  const occurrences = expandOccurrences(data.slots, data.repeatWeeks);
  if (occurrences.length > 60) throw ApiError.badRequest('That creates too many dates at once (max 60)');
  occurrences.forEach((o) => assertOccurrence(o));
  assertNoSelfOverlap(occurrences);

  const people = await loadPeople();
  const isPersonal = Boolean(data.isPersonal);
  const invitees = isPersonal ? [] : [...new Set((data.invitees || []).map(idOf))].filter((id) => id !== viewer.id);
  const unknown = invitees.filter((id) => !people.get(id)?.listed);
  if (unknown.length) throw ApiError.badRequest('Some of the people picked are no longer active');

  await assertAllFree(viewer, [viewer.id], occurrences, { selfMessage: 'You are', people });
  await assertAllFree(viewer, invitees, occurrences, { people });

  const series = occurrences.length > 1 ? new mongoose.Types.ObjectId() : undefined;
  const now = new Date();
  const docs = await WeeklyEvent.insertMany(
    occurrences.map((o) => ({
      title: data.title,
      description: data.description,
      category: data.category,
      isPersonal,
      openForAll: isPersonal ? false : Boolean(data.openForAll),
      location: data.location,
      link: data.link,
      ...o,
      host: viewer.id,
      series,
      attendees: invitees.map((user) => ({ user, status: INVITED, invitedBy: viewer.id, invitedAt: now })),
    }))
  );

  if (invitees.length) {
    sendInvites(docs[0], docs, invitees, people, { inviterId: viewer.id, scope: series ? 'series' : 'one' }).catch((err) =>
      logger.error({ err }, 'sendInvites failed')
    );
  }
  return { events: docs.map((d) => shapeEvent(d.toObject(), viewer, people)), count: docs.length };
}

// The occurrences an action applies to: just this one, or this and every
// later one in its series that hasn't happened yet.
async function scopedEvents(event, scope) {
  if (scope !== 'series' || !event.series) return [event];
  const today = nowIst().day;
  return WeeklyEvent.find({ series: event.series, cancelledAt: null, day: { $gte: event.day < today ? today : event.day } }).sort({ day: 1, startMin: 1 });
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
    assertOccurrence(next);
    await assertAllFree(viewer, [idOf(event.host)], [next], {
      selfMessage: isHost(event, viewer) ? 'You are' : 'The host is',
      people,
      excludeEventIds: [event._id],
    });
    Object.assign(event, next);
    // Everyone has to confirm the new time again.
    const reconfirm = event.attendees.filter((a) => a.status === ACCEPTED);
    reconfirm.forEach((a) => {
      a.status = INVITED;
      a.respondedAt = undefined;
    });
    event.reminderSentAt = undefined;
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

async function cancelEvent(viewer, id, { scope = 'one', reason }) {
  const event = await loadEvent(id);
  assertCanManage(event, viewer);
  const targets = await scopedEvents(event, scope);
  await WeeklyEvent.updateMany(
    { _id: { $in: targets.map((t) => t._id) } },
    { $set: { cancelledAt: new Date(), cancelledBy: viewer.id, cancelReason: reason } }
  );
  const people = await loadPeople();
  notifyCancelled(targets, people, viewer, reason).catch((err) => logger.error({ err }, 'notifyCancelled failed'));
  return { cancelled: targets.length };
}

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
  await assertAllFree(viewer, toInvite, open, { people });

  const now = new Date();
  for (const t of open) {
    for (const u of toInvite) {
      const existing = attendeeOf(t, u);
      if (existing) Object.assign(existing, { status: INVITED, invitedBy: viewer.id, invitedAt: now, respondedAt: undefined, reason: undefined });
      else t.attendees.push({ user: u, status: INVITED, invitedBy: viewer.id, invitedAt: now });
    }
    await t.save();
  }
  sendInvites(event, open, toInvite, people, { inviterId: viewer.id, scope }).catch((err) => logger.error({ err }, 'sendInvites failed'));
  return getEvent(viewer, id);
}

async function removeAttendee(viewer, id, userId, { scope = 'one' } = {}) {
  const event = await loadEvent(id);
  assertCanManage(event, viewer);
  const targets = await scopedEvents(event, scope);
  for (const t of targets) {
    t.attendees = t.attendees.filter((a) => idOf(a.user) !== userId);
    t.segments = (t.segments || []).filter((s) => idOf(s.user) !== userId);
    await t.save();
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

  for (const t of targets) {
    const a = attendeeOf(t, viewer.id);
    if (response === 'accept') {
      if (a.status === ACCEPTED) continue;
      const conflicts = await findConflicts([viewer.id], [t], { excludeEventIds: [t._id] });
      if (conflicts.size) {
        skipped.push(`${fmtWhen(t)} — you're ${describeConflict(conflicts.get(viewer.id), viewer, people, viewer.id)}`);
        continue;
      }
      a.status = ACCEPTED;
    } else {
      a.status = DECLINED;
      a.reason = reason;
    }
    a.respondedAt = new Date();
    await t.save();
    done.push(t);
  }

  if (response === 'accept' && !done.length && skipped.length) throw ApiError.conflict(`Couldn't accept: ${skipped.join('; ')}`);

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
  await assertAllFree(viewer, [viewer.id], [event], { selfMessage: 'You are', people, excludeEventIds: [event._id] });
  const existing = attendeeOf(event, viewer.id);
  if (existing) Object.assign(existing, { status: ACCEPTED, respondedAt: new Date() });
  else event.attendees.push({ user: viewer.id, status: ACCEPTED, invitedBy: viewer.id, respondedAt: new Date() });
  await event.save();
  return getEvent(viewer, id);
}

async function setSegments(viewer, id, segments) {
  const event = await loadEvent(id);
  assertCanManage(event, viewer);
  const members = new Set([idOf(event.host), ...event.attendees.filter((a) => a.status !== DECLINED).map((a) => idOf(a.user))]);
  const sorted = [...segments].sort((a, b) => a.startMin - b.startMin);
  sorted.forEach((s, i) => {
    if (s.startMin < event.startMin || s.endMin > event.endMin || s.endMin <= s.startMin) {
      throw ApiError.badRequest(`Every slice must sit inside ${fmtMin(event.startMin)} – ${fmtMin(event.endMin)}`);
    }
    if (i > 0 && s.startMin < sorted[i - 1].endMin) throw ApiError.badRequest('Two slices overlap');
    if (s.user && !members.has(idOf(s.user))) throw ApiError.badRequest('A slice can only go to someone in this meeting');
  });
  event.segments = sorted.map((s) => ({ startMin: s.startMin, endMin: s.endMin, label: s.label, user: s.user || undefined }));
  await event.save();
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

// An action item becomes a personal task for its assignee in Task Management.
async function noteToTask(viewer, id, noteId) {
  const event = await noteContext(viewer, id);
  const note = event.notes.id(noteId);
  if (!note) throw ApiError.notFound('Note not found');
  if (note.kind !== WEEKLY_NOTE_KIND.ACTION) throw ApiError.badRequest('Only action items can become tasks');
  if (note.task) throw ApiError.conflict('This action item is already a task');
  if (!note.assignee) throw ApiError.badRequest('Pick who the action item is for first');
  const assigneeUser = await User.findById(note.assignee).select('employeeLink');
  if (!assigneeUser?.employeeLink) throw ApiError.badRequest("This person has no employee record, so they can't get a task");

  const due = note.dueDay || addDays(nowIst().day > event.day ? nowIst().day : event.day, 2);
  const task = await employeeTaskService.createTask(
    {
      title: note.text.length > 120 ? `${note.text.slice(0, 117)}…` : note.text,
      description: `From the meeting "${event.title}" on ${fmtDay(event.day)}.\n\n${note.text}`,
      type: EMPLOYEE_TASK_TYPE.PERSONAL,
      startAt: new Date(),
      endAt: toUtc(due, 18 * 60 + 30),
      assignedEmployees: [assigneeUser.employeeLink],
    },
    viewer.employeeLink || undefined
  );
  note.task = task._id;
  note.updatedBy = viewer.id;
  await event.save();
  return getEvent(viewer, id);
}

// ---- Planning helpers ---------------------------------------------------------------------

// Copies everything you host in one week into another, re-inviting the same
// people. Anything that clashes, or is already in the past, is skipped.
async function copyWeek(viewer, { from, to }) {
  const fromStart = mondayOf(from);
  const toStart = mondayOf(to);
  if (fromStart === toStart) throw ApiError.badRequest('Pick a different week to copy into');
  const offset = Math.round((Date.parse(toStart) - Date.parse(fromStart)) / 86_400_000);
  const source = await WeeklyEvent.find({ host: viewer.id, cancelledAt: null, day: { $gte: fromStart, $lte: addDays(fromStart, 6) } })
    .sort({ day: 1, startMin: 1 })
    .lean();
  const people = await loadPeople();
  const created = [];
  const skipped = [];
  const seriesMap = new Map();

  for (const e of source) {
    const occ = { day: addDays(e.day, offset), startMin: e.startMin, endMin: e.endMin };
    try {
      assertOccurrence(occ);
      await assertAllFree(viewer, [viewer.id], [occ], { selfMessage: 'You are', people });
    } catch (err) {
      skipped.push({ title: e.title, day: occ.day, reason: err.message });
      continue;
    }
    const invitees = e.attendees.filter((a) => a.status !== DECLINED && people.get(idOf(a.user))?.listed).map((a) => idOf(a.user));
    const conflicts = await findConflicts(invitees, [occ]);
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
      segments: (e.segments || []).map(({ startMin, endMin, label, user }) => ({ startMin, endMin, label, user })),
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
    occurrences: occurrences.map((o) => ({ day: o.day, startMin: o.startMin, endMin: o.endMin, status: attendeeOf(o, u)?.status ?? null })),
    attendees: event.attendees.filter((a) => a.status === ACCEPTED).map((a) => personOrGone(people, a.user)),
  };
}

async function respondPublic(token, { response, reason }) {
  const { e, u, s } = readInviteToken(token);
  const user = await User.findById(u).select('role isActive');
  if (!user?.isActive) throw ApiError.forbidden('This account is no longer active');
  return respond({ id: u, role: user.role }, e, { response, reason, scope: s });
}

// ---- Reminders & daily digest (jobs/weeklyCalendar.job.js) ------------------------------

async function sendDueReminders() {
  const now = nowIst();
  const due = await WeeklyEvent.find({
    day: now.day,
    cancelledAt: null,
    reminderSentAt: null,
    startMin: { $gt: now.min, $lte: now.min + 10 },
  });
  for (const event of due) {
    const recipients = [idOf(event.host), ...event.attendees.filter((a) => a.status === ACCEPTED).map((a) => idOf(a.user))];
    await notificationService.createForUsers(recipients, {
      type: NOTIFICATION_TYPES.WEEKLY_EVENT_REMINDER,
      title: `Starting at ${fmtMin(event.startMin)}: ${event.title}`,
      message: `${event.location ? `${event.location} · ` : ''}${fmtMin(event.startMin)} – ${fmtMin(event.endMin)}`,
      weeklyEvent: event._id,
    });
    event.reminderSentAt = new Date();
    await event.save();
  }
  return due.length;
}

async function sendDailyDigests() {
  const today = nowIst().day;
  const events = await WeeklyEvent.find({ day: today, cancelledAt: null }).sort({ startMin: 1 }).lean();
  if (!events.length) return 0;
  const people = await loadPeople();
  const perUser = new Map();
  for (const e of events) {
    const holders = [idOf(e.host), ...e.attendees.filter((a) => a.status === ACCEPTED).map((a) => idOf(a.user))];
    for (const h of holders) perUser.set(h, [...(perUser.get(h) || []), e]);
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

module.exports = {
  // helpers (also used by the PDF renderer & tests)
  addDays,
  mondayOf,
  nowIst,
  fmtMin,
  fmtDay,
  loadPeople,
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
};
